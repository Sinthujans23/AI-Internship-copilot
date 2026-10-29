import os
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app

class SecurityTests(unittest.TestCase):
    def test_health_and_private_routes(self):
        with patch.dict(os.environ, {'MATCHING_SERVICE_API_KEY': 'test-only-key'}):
            client = TestClient(app)
            self.assertEqual(client.get('/health').json(), {'status': 'ok'})
            for route in ['/match', '/rank', '/embed', '/pdf/edit', '/pdf/inspect']:
                self.assertEqual(client.post(route, json={}).status_code, 401)
            invalid = client.post('/match', headers={'X-API-Key': 'test-only-key'}, json={'cv_text': 'PRIVATE_CV', 'job_skills': []})
            self.assertEqual(invalid.status_code, 422)
            self.assertNotIn('PRIVATE_CV', invalid.text)
            self.assertNotIn('access-control-allow-origin', client.get('/health', headers={'Origin': 'https://evil.invalid'}).headers)
            large = client.post('/match', headers={'X-API-Key': 'test-only-key'}, content=b'x' * (6 * 1024 * 1024 + 1))
            self.assertEqual(large.status_code, 413)
