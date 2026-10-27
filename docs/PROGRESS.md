# Implementation progress

Complete steps in order. Each implementation gets build/lint checks and a Git commit. Finish manual acceptance checks that need external accounts before moving on.

| Step | Name | Status |
| --- | --- | --- |
| 0 | Setup | Complete: development login page returned HTTP 200; build and lint passed (two existing warnings) |
| 1 | Auth + application tracker | Implemented; Supabase connectivity previously verified; real email confirmation and authenticated acceptance remain manual |
| 2 | Job post to JSON | Implemented; live acceptance requires OpenAI key and Step 2 SQL |
| 3 | CV upload + parse | Implemented; live upload/ownership checks require Step 3 SQL and a signed-in user |
| 4 | Python matching service | Implemented; four Python tests passed; live embeddings require API key and service startup |
| 5 | AI agent with tools | Implemented; eight offline TypeScript tests passed; live preparation requires OpenAI key, matching service, and Step 5 SQL |
| 6 | Polish + deploy | Build/lint/typecheck, 14 TS tests, four Python tests, and production route/service smoke checks passed; hosting/live acceptance remain manual |
| 7 | Company shortlist and coaching | Preferences, source-backed company reports and coaching implemented; new migration and live provider checks required |
| 8 | Original PDF region editor | Implemented; text-region preview/save preserves original, rejects overflow, and keeps page geometry; custom fonts/rotated/scanned/signed PDFs are unsupported |

The initial Git snapshot preserves earlier prototype code. It has now been replaced by the supported structured job analyzer, profile, FastAPI service, and bounded tool-calling agent. Each step's implementation was checked and committed in order. Build/offline tests do not establish live account, provider, or hosting acceptance.

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
