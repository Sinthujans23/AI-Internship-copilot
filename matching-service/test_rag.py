import os
import unittest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from main import app


class RagTests(unittest.TestCase):
    @patch.dict(os.environ, {"MATCHING_SERVICE_API_KEY": "test-only", "AI_PROVIDER": "openrouter", "OPENROUTER_EMBEDDING_MODEL": "test-model"})
    def test_embed_auth_bounds_and_model(self):
        client=TestClient(app)
        self.assertEqual(client.post("/embed",json={"texts":["Required Python"]}).status_code,401)
        headers={"X-API-Key":"test-only"}
        for texts in [[],[" "],["a"*3001],["a"]*65]:
            self.assertEqual(client.post("/embed",headers=headers,json={"texts":texts}).status_code,422)
        with patch("main.embed_texts",new=AsyncMock(return_value=[[1.0,0.0]])):
            result=client.post("/embed",headers=headers,json={"texts":["Required Python"]})
        self.assertEqual(result.json(),{"model":"openrouter:test-model","dimensions":2,"vectors":[[1.0,0.0]]})

    @patch.dict(os.environ, {"MATCHING_SERVICE_API_KEY": "test-only"})
    def test_invalid_embedding_vectors(self):
        for vectors in [[],[[0,0]],[[float("nan"),0]],[[1,0],[1]]]:
            with patch("main.embed_texts",new=AsyncMock(return_value=vectors)):
                result=TestClient(app).post("/embed",headers={"X-API-Key":"test-only"},json={"texts":["Required Python"]})
                self.assertEqual(result.status_code,502)


if __name__=="__main__":
    unittest.main()
