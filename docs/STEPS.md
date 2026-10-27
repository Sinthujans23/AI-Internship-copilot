# Step-by-step verification

Implementation continues through the remaining steps at your request. External setup and live acceptance tests are tracked separately; passing a build is not a live AI test.

## Step 2: Job post to JSON

Changed: `src/app/(workspace)/jobs/page.tsx`, `src/components/job-analyzer.tsx`, `src/app/api/analyze-job/route.ts`, `src/lib/ai/*`, `src/lib/job-schema.ts`, `src/lib/api.ts`, application validation/types/queries, navigation, and `.env.example`.

Setup: run `supabase/migrations/20261027000000_step2_job_analysis.sql` in SQL Editor. Add `OPENAI_API_KEY` and optionally `OPENAI_MODEL` (default `gpt-4o-mini`) to `.env.local`. Never prefix the AI key with `NEXT_PUBLIC_`.

Run: `npm.cmd run dev`. Open `/jobs` after logging in. Paste a real job post (40–20,000 characters), analyze, inspect the role/company/skills/responsibilities, then save. Refresh `/dashboard` to check persistence. Try short input and a missing AI key to check errors. A model refusal or invalid/incomplete model output returns a readable error instead of unvalidated data.
