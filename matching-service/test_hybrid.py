import os
import unittest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from main import app


class HybridTests(unittest.TestCase):
    @patch.dict(os.environ, {"MATCHING_SERVICE_API_KEY": "test-only"})
    def test_batch_auth_validation_and_semantics(self):
        client = TestClient(app)
        body = {"cv_text": "Built React applications", "jobs": [{"id": "react", "text": "Frontend React"}, {"id": "sales", "text": "Sales internship"}]}
        self.assertEqual(client.post("/rank", json=body).status_code, 401)
        headers = {"X-API-Key": "test-only"}
        with patch("main.embed_texts", new=AsyncMock(return_value=[[1, 0], [1, 0], [0, 1]])):
            result = client.post("/rank", headers=headers, json=body)
        self.assertEqual(result.status_code, 200)
        self.assertEqual(result.json()["scores"], {"react": 1.0, "sales": 0.0})
        body["jobs"] *= 20
        self.assertEqual(client.post("/rank", headers=headers, json=body).status_code, 422)

    @patch.dict(os.environ, {"MATCHING_SERVICE_API_KEY": "test-only"})
    def test_invalid_vectors_do_not_produce_scores(self):
        with patch("main.embed_texts", new=AsyncMock(return_value=[[1], [1, 0]])):
            result=TestClient(app).post("/rank", headers={"X-API-Key":"test-only"}, json={"cv_text":"CV", "jobs":[{"id":"1","text":"Job"}]})
        self.assertEqual(result.status_code,502)


if __name__ == "__main__":
    unittest.main()
