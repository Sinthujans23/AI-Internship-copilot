# Implementation progress

Complete steps in order. Each implementation gets build/lint checks and a Git commit. Finish manual acceptance checks that need external accounts before moving on.

| Step | Name | Status |
| --- | --- | --- |
| 0 | Setup | Complete: development login page returned HTTP 200; build and lint passed (two existing warnings) |
| 1 | Auth + application tracker | Existing implementation; Supabase configuration and live checks pending |
| 2 | Job post to JSON | Pending |
| 3 | CV upload + parse | Pending |
| 4 | Python matching service | Pending |
| 5 | AI agent with tools | Pending |
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
