"""Private FastAPI service: Next.js calls this, never the browser."""
import hmac
import os
import re

import httpx
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from matching import score_embeddings

load_dotenv()
app = FastAPI(title="AI Internship Copilot Matching", version="1.0.0")


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


async def embed_texts(texts: list[str]) -> list[list[float]]:
    key = os.getenv("OPENAI_API_KEY")
    if not key:
        raise HTTPException(503, "Configure OPENAI_API_KEY in the matching service")
    try:
        async with httpx.AsyncClient(timeout=40) as client:
            response = await client.post("https://api.openai.com/v1/embeddings",
                headers={"Authorization": f"Bearer {key}"},
                json={"model": os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"), "input": texts})
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
