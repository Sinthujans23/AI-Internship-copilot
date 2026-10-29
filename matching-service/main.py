"""Private FastAPI service: Next.js calls this, never the browser."""
import hmac
import os
import re
import math

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from security import PrivateBodyLimit
from pydantic import BaseModel, Field, field_validator, model_validator

from matching import score_embeddings, cosine
from pdf_routes import router as pdf_router

load_dotenv()
app = FastAPI(title="AI Internship Copilot Matching", version="1.0.0", docs_url=None, redoc_url=None, openapi_url=None)
app.add_middleware(PrivateBodyLimit)

@app.exception_handler(RequestValidationError)
async def invalid_request(_request, _error):
    return JSONResponse({"detail": "Invalid request fields or size"}, status_code=422)


class MatchInput(BaseModel):
    cv_text: str = Field(default="", max_length=50000)
    cv_skills: list[str] = Field(default_factory=list, max_length=100)
    job_skills: list[str] = Field(min_length=1, max_length=100)

    @field_validator("cv_skills", "job_skills")
    @classmethod
    def clean_skills(cls, skills):
        if any(not skill.strip() or len(skill) > 200 for skill in skills):
            raise ValueError("Skills must be nonempty strings of at most 200 characters")
        return list(dict.fromkeys(skill.strip() for skill in skills))

    @model_validator(mode="after")
    def has_cv(self):
        if not self.cv_text.strip() and not self.cv_skills:
            raise ValueError("Provide CV text or CV skills")
        return self


class MatchOutput(BaseModel):
    score: int = Field(ge=0, le=100)
    matched_skills: list[str]
    missing_skills: list[str]


def require_service_key(x_api_key: str | None = Header(default=None)):
    expected = os.getenv("MATCHING_SERVICE_API_KEY", "")
    if not expected:
        raise HTTPException(503, "Configure MATCHING_SERVICE_API_KEY")
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), expected.encode()):
        raise HTTPException(401, "Invalid service key")


app.include_router(pdf_router, dependencies=[Depends(require_service_key)])


class EmbedInput(BaseModel):
    texts: list[str] = Field(min_length=1, max_length=64)

    @field_validator("texts")
    @classmethod
    def bounded_texts(cls, texts):
        if any(not text.strip() or len(text) > 3000 for text in texts) or sum(map(len, texts)) > 100000:
            raise ValueError("Embedding text size limit exceeded")
        return texts


@app.post("/embed", dependencies=[Depends(require_service_key)])
async def embed(payload: EmbedInput):
    vectors = await embed_texts(payload.texts)
    try:
        dimensions = len(vectors[0])
        if not 1 <= dimensions <= 3072 or len(vectors) != len(payload.texts):
            raise ValueError("Invalid dimensions")
        if any(len(v) != dimensions or not all(math.isfinite(x) for x in v) or not any(x != 0 for x in v) for v in vectors):
            raise ValueError("Invalid vectors")
    except (IndexError, ValueError, TypeError):
        raise HTTPException(502, "Invalid embedding response") from None
    router = os.getenv("AI_PROVIDER") == "openrouter"
    model = os.getenv("OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small") if router else os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    return {"model": ("openrouter:" if router else "openai:") + model, "dimensions": dimensions, "vectors": vectors}


class RankJob(BaseModel):
    id: str = Field(min_length=1, max_length=250)
    text: str = Field(min_length=1, max_length=6000)


class RankInput(BaseModel):
    cv_text: str = Field(min_length=1, max_length=50000)
    jobs: list[RankJob] = Field(min_length=1, max_length=30)


@app.post("/rank", dependencies=[Depends(require_service_key)])
async def rank(payload: RankInput):
    # One private batch avoids one network call per job. No CV text is logged or cached.
    text = re.sub(r"\s+", " ", payload.cv_text).strip()
    if not text or len({job.id for job in payload.jobs}) != len(payload.jobs):
        raise HTTPException(422, "Provide CV text and unique job IDs")
    chunks = [text[i:i + 2000] for i in range(0, len(text), 1800)]
    vectors = await embed_texts(chunks + [job.text for job in payload.jobs])
    try:
        return {"scores": {job.id: sum(cosine(vectors[len(chunks)+i], v) for v in vectors[:len(chunks)]) / len(chunks)
                           for i, job in enumerate(payload.jobs)}}
    except (ValueError, TypeError, OverflowError, IndexError):
        raise HTTPException(502, "Could not calculate semantic relevance") from None


async def embed_texts(texts: list[str]) -> list[list[float]]:
    router = os.getenv("AI_PROVIDER") == "openrouter"
    key_name = "OPENROUTER_API_KEY" if router else "OPENAI_API_KEY"
    key = os.getenv(key_name)
    base = "https://openrouter.ai/api/v1" if router else "https://api.openai.com/v1"
    model = os.getenv("OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small") if router else os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
    if not key:
        raise HTTPException(503, f"Configure {key_name} in the matching service")
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            response = await client.post(f"{base}/embeddings",
                headers={"Authorization": f"Bearer {key.strip()}"},
                json={"model": model, "input": texts, "encoding_format": "float"})
        if response.status_code == 401:
            raise HTTPException(503, f"Embedding provider rejected {key_name}. Update the matching service key and restart.")
        if response.status_code == 402:
            raise HTTPException(402, "OpenRouter embedding credits are insufficient. Check billing and key spending limits.")
        if response.status_code == 429:
            raise HTTPException(429, "Embedding API quota or rate limit reached")
        if not response.is_success:
            raise HTTPException(502, "Embedding provider rejected the request")
        data = sorted(response.json()["data"], key=lambda row: row["index"])
        if len(data) != len(texts) or [row["index"] for row in data] != list(range(len(texts))):
            raise ValueError("Incomplete embeddings")
        return [row["embedding"] for row in data]
    except httpx.TimeoutException:
        raise HTTPException(504, "Embedding provider timed out") from None
    except (httpx.HTTPError, KeyError, ValueError, TypeError):
        raise HTTPException(502, "Could not retrieve valid embeddings") from None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/match", response_model=MatchOutput, dependencies=[Depends(require_service_key)])
async def match(payload: MatchInput):
    # Small chunks keep each embedding input within model limits.
    text = re.sub(r"\s+", " ", payload.cv_text).strip()
    chunks = [text[i:i + 600] for i in range(0, len(text), 500)]
    evidence = payload.cv_skills + chunks
    vectors = await embed_texts(evidence + payload.job_skills)
    try:
        threshold = float(os.getenv("MATCH_THRESHOLD", "0.65"))
        if not 0 < threshold <= 1:
            raise ValueError("Invalid threshold")
        return score_embeddings(vectors[:len(evidence)], vectors[len(evidence):], payload.cv_skills, payload.job_skills, threshold)
    except (ValueError, TypeError, OverflowError):
        raise HTTPException(502, "Could not calculate a valid match score") from None
