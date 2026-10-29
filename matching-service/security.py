"""Bound request bodies before Pydantic parses them; do not echo private invalid inputs."""
import hmac
import os
from starlette.responses import JSONResponse

class PrivateBodyLimit:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http' or scope['path'] == '/health':
            return await self.app(scope, receive, send)
        headers = dict(scope.get('headers', []))
        expected = os.getenv('MATCHING_SERVICE_API_KEY', '')
        supplied = headers.get(b'x-api-key', b'')
        if not expected or not hmac.compare_digest(supplied, expected.encode()):
            return await JSONResponse({'detail': 'Service authentication required'}, status_code=401 if expected else 503)(scope, receive, send)
        chunks, size = [], 0
        while True:
            message = await receive()
            if message['type'] == 'http.disconnect':
                return
            chunk = message.get('body', b'')
            size += len(chunk)
            if size > 6 * 1024 * 1024:
                return await JSONResponse({'detail': 'Request too large'}, status_code=413)(scope, receive, send)
            chunks.append(chunk)
            if not message.get('more_body', False):
                break
        body = b''.join(chunks)
        delivered = False
        async def limited_receive():
            nonlocal delivered
            if not delivered:
                delivered = True
                return {'type': 'http.request', 'body': body, 'more_body': False}
            return await receive()
        await self.app(scope, limited_receive, send)
