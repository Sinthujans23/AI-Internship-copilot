# Validation record — 2026-10-27

## Company research and PDF editor extension

- Production build and lint passed; 26 TypeScript tests and 11 Python tests passed.
- Production HTTP checks confirmed login redirects for company/PDF pages and 401 responses for anonymous company preferences, research, PDF editing and downloads.
- A real local PDF service rejected missing credentials, inspected a synthetic two-page CV and returned an edited PDF. The Next.js parser extracted the replacement and confirmed removal of the old text.
- PDF tests compare unchanged page/heading pixels and page geometry, preserve the source bytes, and reject overflow, invalid edits and text over scanned images.
- Website tests cover URL/DNS protections, source evidence, salary units, role isolation and technology word boundaries. A public HTML fetch also succeeded without sending CV data or making a paid AI call.
- Signed-in storage saves, company generation with a valid AI key, two-user isolation and deployment still require manual acceptance. Run the updated SQL before using company research.

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

## AI authentication follow-up

A read-only OpenAI model-access request returned HTTP 401 with `invalid_api_key`. No generation request was made and no key value/provider message was printed. Replacing the key requires the user's OpenAI account; model generation access and billing have not been verified.

The app now distinguishes invalid API keys, model access, quota exhaustion, rate limits, and connection failures using fixed public messages. Build/lint passed and the expanded TypeScript suite passed all 17 tests, including three provider-error classification/redaction regressions.

## CV Analyzer v2 ? 2026-10-28

- 50 TypeScript tests and 12 Python tests passed, including new v2 section/scoring/feedback/ownership/save-failure tests and existing real PDF extraction/editing regressions.
- Build and lint passed. Production review/history endpoints returned 401 to anonymous GET and POST requests.
- An isolated PostgreSQL 17 container ran the real migration with synthetic auth roles/users. Assertions passed for history save/retrieve, v1 preservation, RLS isolation, anonymous denial, immutable completed snapshots, cache, duplicate prevention, five-per-hour limits and outdated-result handling. Rerunning the migration inserted no duplicate legacy row and preserved all completed/failed/outdated snapshots.
- Additional rewrite checks preserve qualifiers and disallow changing testing into development claims; focused v2 tests were rerun.
- Hosted Supabase migration, live AI generation, signed-in Storage/browser acceptance and deployment remain manual. No private CVs were sent to an AI provider during automated verification.


## Hybrid job matching - 2026-10-28

- All 56 TypeScript tests passed; the final focused hybrid tests also passed. All 14 Python matching/PDF tests passed. Build and lint passed.
- Real isolated PostgreSQL 17 assertions passed for save/retrieve, RLS cross-user denial, foreign CV rejection, anonymous denial, atomic rate limits and migration rerun.
- Anonymous POST /api/jobs/search returned 401 on the production build.
- Live public adapter checks returned two IFS Sri Lanka internships with official application links, zero current IFS India internships, and 100 Jobicy keyword-feed records before internship title filtering. Counts are time-dependent.
- Offline and actual OpenRouter openai/text-embedding-3-small runs both returned mean Recall@3 and NDCG@3 of 1.000 on three synthetic CVs/eight labelled fictional jobs. This is a small regression benchmark, not real-world validation. No personal CV data was used.
- The hosted Supabase migration and signed-in end-to-end acceptance remain manual. See docs/HYBRID_JOB_MATCHING.md for commands and limitations.

## GitHub Intelligence - 2026-10-28

- Production build and lint passed. All 66 TypeScript tests passed, including 10 new GitHub validation, pagination, API failure, skill extraction, evidence grounding, CV comparison and ownership tests.
- Isolated PostgreSQL 17 tests passed for analysis/approval save-retrieve, RLS separation, foreign CV rejection, unsupported skill rejection, revocation, anonymous denial, rate limits and migration rerun.
- Anonymous GET and POST /api/github returned 401 on the production build.
- Live official GitHub API check fetched octocat public repositories and Hello-World metadata/README successfully without sending CV data or making AI calls.
- Hosted Supabase SQL application, signed-in browser acceptance and live GitHub-specific AI generation remain manual. See docs/GITHUB_INTELLIGENCE.md.
