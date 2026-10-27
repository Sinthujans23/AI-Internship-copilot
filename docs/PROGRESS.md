# Implementation progress

Complete steps in order. Each implementation gets build/lint checks and a Git commit. Finish manual acceptance checks that need external accounts before moving on.

| Step | Name | Status |
| --- | --- | --- |
| 0 | Setup | Complete: development login page returned HTTP 200; build and lint passed (two existing warnings) |
| 1 | Auth + application tracker | Local implementation build/lint passed (two existing warnings); nullable match_score added; Supabase configuration and live checks pending |
| 2 | Job post to JSON | Implemented; live acceptance requires OpenAI key and Step 2 SQL |
| 3 | CV upload + parse | Implemented; live upload/ownership checks require Step 3 SQL and a signed-in user |
| 4 | Python matching service | Implemented; four Python tests passed; live embeddings require API key and service startup |
| 5 | AI agent with tools | Implemented; eight offline TypeScript tests passed; live preparation requires OpenAI key, matching service, and Step 5 SQL |
| 6 | Polish + deploy | Pending |

Earlier prototype AI/CV files are preserved in the initial repository snapshot. They do not establish completion of Steps 2–5. Later steps will follow the requested API contracts and use a separate FastAPI service.

## Target folders

- `src/app`: Next.js pages and API routes
- `src/components`: reusable UI
- `src/lib`: Supabase, validation, and server helpers
- `src/types`: shared types
- `supabase/migrations`: SQL tables and access policies
- `docs`: progress and setup notes
- `matching-service`: created in Step 4 for FastAPI

## Commit names

- `Step 0: Setup`
- `Step 1: Auth + application tracker`
- `Step 2: Job post to JSON`
- `Step 3: CV upload + parse`
- `Step 4: Python matching service`
- `Step 5: AI agent with tools`
- `Step 6: Polish + deploy`
