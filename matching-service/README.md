# Matching service

Python 3.11+; FastAPI with OpenAI `text-embedding-3-small` embeddings and cosine similarity. No local model or PyTorch download is needed. CV text and skill names are sent to OpenAI for embedding.

```powershell
cd matching-service
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Fill `.env` with your `OPENAI_API_KEY` and a random `MATCHING_SERVICE_API_KEY`. Put the same service key in the Next.js `.env.local`, together with `MATCHING_SERVICE_URL=http://127.0.0.1:8000`.

```powershell
.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
.venv\Scripts\python.exe -m unittest -v
```

`GET /health` is public. `POST /match` needs `X-API-Key`; the server returns 401 for a missing/wrong key, 422 for invalid input, and readable 429/502/503/504 provider/configuration errors. Tests mock embeddings and never call a paid API.

Input: `{ "cv_text": "...", "cv_skills": ["Python"], "job_skills": ["Python", "SQL"] }`.
Output: `{ "score": 72, "matched_skills": ["Python"], "missing_skills": ["SQL"] }` (illustrative only).

For each job skill, take its highest cosine similarity to a CV skill or overlapping 600-character text chunk. Explicit identical skill names count as 1. Score = rounded mean similarity × 100. Similarity ≥ `MATCH_THRESHOLD` (default 0.65) is a match. The threshold is a heuristic, not a calibrated hiring prediction. No skills yields 422 instead of a fabricated score.
