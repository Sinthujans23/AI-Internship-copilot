import os
import unittest
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient
from main import app
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


if __name__ == "__main__":
    unittest.main()
