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
