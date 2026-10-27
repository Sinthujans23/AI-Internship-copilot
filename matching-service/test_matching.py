import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from main import app, embed_texts
import asyncio
import httpx
from fastapi import HTTPException
from matching import cosine, score_embeddings


class MatchingTests(unittest.TestCase):
    def test_similarity_and_missing_skills(self):
        result = score_embeddings([[1.0, 0.0]], [[1.0, 0.0], [0.0, 1.0]], [], ["Python", "Design"])
        self.assertEqual(result, {"score": 50, "matched_skills": ["Python"], "missing_skills": ["Design"]})

    def test_exact_skills_and_zero_vector(self):
        self.assertEqual(cosine([0.0, 0.0], [1.0, 0.0]), 0)
        self.assertEqual(score_embeddings([], [[0.0, 1.0]], ["PYTHON"], ["Python"])["score"], 100)

    def test_invalid_vectors(self):
        with self.assertRaises(ValueError):
            cosine([1.0], [1.0, 2.0])
        with self.assertRaises(ValueError):
            cosine([float("nan")], [1.0])

    @patch.dict(os.environ, {"MATCHING_SERVICE_API_KEY": "test-only-key"})
    def test_auth_validation_and_endpoint(self):
        client = TestClient(app)
        body = {"cv_skills": ["Python"], "job_skills": ["Python", "Design"]}
        self.assertEqual(client.post("/match", json=body).status_code, 401)
        headers = {"X-API-Key": "test-only-key"}
        self.assertEqual(client.post("/match", json={"job_skills": []}, headers=headers).status_code, 422)
        with patch("main.embed_texts", new=AsyncMock(return_value=[[1.0, 0.0], [1.0, 0.0], [0.0, 1.0]])):
            response = client.post("/match", json=body, headers=headers)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["score"], 50)


    @patch.dict(os.environ, {"AI_PROVIDER": "openrouter", "OPENROUTER_API_KEY": "test-router-key", "OPENROUTER_EMBEDDING_MODEL": "openai/text-embedding-3-small"})
    def test_openrouter_embedding_route_and_billing(self):
        response = httpx.Response(200, json={"data": [{"index": 0, "embedding": [1.0, 0.0]}]})
        with patch("main.httpx.AsyncClient") as factory:
            client = factory.return_value.__aenter__.return_value
            client.post = AsyncMock(return_value=response)
            self.assertEqual(asyncio.run(embed_texts(["Python"])), [[1.0, 0.0]])
            args = client.post.call_args
            self.assertEqual(args.args[0], "https://openrouter.ai/api/v1/embeddings")
            self.assertEqual(args.kwargs["headers"]["Authorization"], "Bearer test-router-key")
            self.assertEqual(args.kwargs["json"]["model"], "openai/text-embedding-3-small")
            client.post.return_value = httpx.Response(402, json={})
            with self.assertRaises(HTTPException) as failure:
                asyncio.run(embed_texts(["Python"]))
            self.assertEqual(failure.exception.status_code, 402)


if __name__ == "__main__":
    unittest.main()
