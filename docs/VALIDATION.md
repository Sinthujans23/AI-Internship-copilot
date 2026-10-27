# Validation record — 2026-10-27

## Passed locally

- Every Step 2–5 implementation passed `npm.cmd run lint` and `npm.cmd run build` before its named Git commit. The obsolete prototype's unused-variable warning was removed in Step 6.
- Final `npm.cmd run lint`: no errors or warnings.
- Final `npm.cmd run typecheck`: passed.
- Final `npm.cmd run build`: production build passed.
- Final `npm.cmd test`: 14 TypeScript tests passed. Includes real PDF extraction and blank-PDF handling, bounded tool loops, rejection of premature answers/foreign arguments/unknown tools, ownership scoping, config/output validation, and fake matching failures.
- `python -m unittest -v` in `matching-service`: four tests passed with mocked embeddings; no paid calls.
- Production HTTP checks on a temporary Next.js port: login/signup/confirmation-help pages returned 200; dashboard/jobs/profile redirected anonymous users to login; all six private POST APIs returned 401 before processing data.
- The production CV route's file trace includes the PDF worker.
- A real local Uvicorn process returned `/health` successfully and rejected unauthenticated `/match` requests with 401.
- Git confirms `.env.local` and `matching-service/.env` are ignored and untracked. Setup generated the shared service key without printing it; existing nonempty configuration was preserved.

The real-PDF regression exposed an old parser failure on a PDF independently readable by another parser. The app now uses maintained `pdf-parse` 2.x, explicit worker setup, cleanup via `destroy()`, and actual page text instead of page-number separators.

## Still requires manual acceptance

- Run the updated `supabase/setup.sql`; the new schema has not been applied to your hosted database automatically.
- Confirm a real signup email on the same computer/browser, then verify logged-in CRUD/persistence and two-user RLS/storage isolation.
- Add an OpenAI API key to both local env files. It was missing when local setup ran. Verify actual job output, embeddings, and agent quality/quota with your own account.
- Test the PDF upload/replacement flow against your actual private bucket using a signed-in account.
- Test mobile layout, keyboard interaction, and browser clipboard behavior.
- Deploy to Vercel/Render, configure production callbacks/env values, and run the production checklist in `DEPLOYMENT.md`.

Offline tests and anonymous route checks do not establish live provider access, end-to-end signed-in behavior, or successful hosting deployment.
