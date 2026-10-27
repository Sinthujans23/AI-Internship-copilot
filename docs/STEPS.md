# Step-by-step verification

Implementation continues through the remaining steps at your request. External setup and live acceptance tests are tracked separately; passing a build is not a live AI test.

## Step 2: Job post to JSON

Changed: `src/app/(workspace)/jobs/page.tsx`, `src/components/job-analyzer.tsx`, `src/app/api/analyze-job/route.ts`, `src/lib/ai/*`, `src/lib/job-schema.ts`, `src/lib/api.ts`, application validation/types/queries, navigation, and `.env.example`.

Setup: run `supabase/migrations/20261027000000_step2_job_analysis.sql` in SQL Editor. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-4o-mini`) to `.env.local`. Never prefix the AI key with `NEXT_PUBLIC_`.

Run: `npm.cmd run dev`. Open `/jobs` after logging in. Paste a real job post (40–20,000 characters), analyze, inspect the role/company/skills/responsibilities, then save. Refresh `/dashboard` to check persistence. Try short input and a missing AI key to check errors. A model refusal or invalid/incomplete model output returns a readable error instead of unvalidated data.

## Step 3: CV upload + parse

Changed: `/profile`, `CvProfile`, CV upload/delete APIs, skill extraction, database types, navigation, and Step 3 SQL. `/cvs` now redirects to `/profile`.

Run `supabase/migrations/20261027010000_step3_cvs.sql` in SQL Editor, then `npm.cmd run dev`. The migration adds a skills array and configures a private `cvs` PDF bucket with a 4 MB limit. The lower application limit fits typical serverless request limits.

Test: upload a small text-based CV PDF, inspect its text and skill chips, refresh, then replace it with a second PDF. Confirm that the new CV is current and the old row/file is removed. Delete it and refresh. Reject a renamed non-PDF, empty file, oversized PDF, and scanned image-only PDF. A second account must not see the CV or download its private file. No LLM is needed for extraction: an explicit skill vocabulary seeds skills; semantic matching also reads the full text. If cleanup fails after replacement, the saved new CV remains current and a warning asks you to delete the old entry.

## Step 4: Python matching service

Changed: `matching-service/*`, Next.js matching/context helpers, `/api/match`, dashboard match component, database types/queries, env template, and Step 4 SQL.

Run the Step 4 SQL. Follow `matching-service/README.md` to start FastAPI on port 8000. Configure the same `MATCHING_SERVICE_API_KEY` on both servers and the service URL in `.env.local`; the service also needs `OPENAI_API_KEY`. Start Next.js and click **Check CV match** for a saved job after uploading your CV. Refresh to see the persisted result. A manually added job is analyzed first when it has no structured requirements.

Run `python -m unittest -v` from `matching-service`. Four offline tests cover similarity/missing skills, exact matching, malformed/zero vectors, endpoint validation, and service authentication. Live semantic quality and provider access require a real embedding API key. No skills in a job returns an error instead of an arbitrary score.

## Step 5: AI agent with tools

Changed: `/api/agent`, agent loop/orchestrator and schemas, dashboard preparation UI and copy buttons, application persistence/types, offline TypeScript tests, and Step 5 SQL.

Run Step 5 SQL, start FastAPI and Next.js, and click **Prepare my application**. The model chooses available tools; the server executes `analyze_job`, `get_cv`, `match_score`, `rewrite_bullets`, and `draft_email`, returns each output to the model, and accepts a final answer only after all tools finish. Tools cannot accept arbitrary user IDs or CV IDs. The loop has an eight-turn limit and tools become available only when prerequisites have completed.

Test: expect a score, missing skills, exactly three bullets, a draft email, and copy buttons. Refresh to verify all results remain. Confirm the CV filename/timestamp, replace your CV, and re-run to regenerate. Review every fact and placeholder before copying; email is never sent. Try a different user's application ID: expect 404 before any paid AI call.

`npm.cmd test` runs eight offline tests for complete tool loops, early final answers, foreign tool arguments, unsupported tools/order, invalid JSON/refusals, job validation, skill extraction, and score bounds. These tests do not verify live model quality or billing access.

## Step 6: Polish + deploy

Changed: score card/skill chips, application counters/search/status filters, responsive/global styles, profile page auth, confirmation resend, current-route redirects, modern PDF parser/worker setup, deployment/env/SQL scripts, Render config, README and deployment docs. The obsolete prototype analyzer/scorer has been removed.

Run `npm.cmd run setup:env` to prepare ignored local env files; it generates a shared matching-service key without printing it and preserves nonempty values. Add the real OpenAI key to both env files. Run the entire `supabase/setup.sql` in SQL Editor for all new columns/policies. `npm.cmd run sql` regenerates it from supported migrations.

Final offline tests also cover malformed configuration, cross-user application scoping before CV access, invalid provider output, invalid matching partitions, service outages, and a real generated PDF. The PDF regression exposed the obsolete parser's failure on a valid PDF; the modern PDFParse API with explicit worker setup passes it. Use Node 22.3+ (22.18 was tested).

Follow `docs/DEPLOYMENT.md` for account provisioning, environment variables, Vercel/Render deployment, callback URLs, and production tests. These are manual account actions; no site has been published. Test mobile width, keyboard focus, disabled loading controls, score/skill cards, copy buttons, and failure messages. Confirm signup/email confirmation and all persisted flows using two real accounts before calling the app live-verified.

Final result: build, lint (zero warnings), typecheck, 14 TypeScript tests, four Python tests, and production page/API/FastAPI smoke checks passed. See `docs/VALIDATION.md` for the precise evidence and remaining manual checks.
