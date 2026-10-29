# API reference

All private endpoints require the Supabase session cookie. There is no browser-accessible service-role credential. Inputs use Zod, owned IDs and bounded bodies. Invalid input returns 400/422; unauthenticated requests 401; missing/foreign resources generally 404; quotas 429; duplicate/in-flight operations 409; unavailable dependencies 502/503/504. Errors contain safe messages, not provider bodies or credentials.

| Route | Methods | Purpose/input |
| --- | --- | --- |
| /api/health | GET | Public liveness only |
| /api/auth/callback | GET | Exchange confirmation code and redirect to profile |
| /api/applications | GET POST PATCH DELETE | List/create/edit; `{id,status}` remains compatible; `?history=id` events; `?id=id` delete |
| /api/analyze-job, /api/analyze | POST | `{job_text}` structured requirements; shared paid-operation quota/cache |
| /api/match | POST | `{application_id}` owned CV/job comparison |
| /api/agent | POST | `{application_id}` bounded preparation tool loop; never sends mail |
| /api/cvs | GET POST | Owned versions; multipart PDF up to 4 MiB, optional tailoring_id |
| /api/cvs/delete | POST | `{id}` explicit owned-file/version deletion |
| /api/cvs/download | GET | `?cv_id=id` authenticated private PDF download |
| /api/cvs/pdf | GET POST | Inspect `cv_id,page`; preview `{cv_id,edits}` |
| /api/cvs/review | GET POST | History by cv_id; review `{cv_id,force}` |
| /api/jobs/search | POST | Current CV/preferences public-feed discovery and ranking |
| /api/career-preferences | GET PUT | Saved role/location/work-mode/salary preferences |
| /api/company-research | GET POST DELETE | `{url,preferences}` RAG research; delete by id |
| /api/github | GET POST | Public repository list/analyze/approve/revoke actions |
| /api/learning | GET POST | Plans/tasks; generate/update/recommend actions |
| /api/tailoring | GET POST PATCH | `{cv_id,application_id}` proposals; `{id,index,decision}` review |

Schemas in the corresponding route/lib files are authoritative. Dashboard analytics are server-component reads rather than a duplicate analytics endpoint. API mutation requests carrying a foreign Origin are rejected. Origin-less authenticated CLI calls are still supported.

FastAPI: public GET `/health`; private POST `/match`, `/rank`, `/embed`, `/pdf/inspect`, `/pdf/edit` require `X-API-Key`. Maximum body is 6 MiB before model parsing; individual text/PDF limits are stricter. API documentation routes are disabled. No CORS middleware is enabled, because Next.js calls the service server-to-server.
