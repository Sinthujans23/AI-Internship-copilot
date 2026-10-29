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

## Company RAG Intelligence - 2026-10-28

- Production build/lint and all 73 TypeScript tests passed; final focused RAG tests also passed after general-company versus vacancy isolation checks. All 16 Python matching/PDF/RAG tests passed.
- Real pgvector/PostgreSQL 17 tests passed for semantic relevance order, document/model/dimension filters, ownership/RLS, foreign-source poisoning denial, anonymous denial and migration rerun.
- Live OpenRouter openai/text-embedding-3-small returned 1,536-dimensional embeddings for three synthetic strings: relevant cosine 0.727, unrelated cosine 0.121. This is one sanity example, not a general quality benchmark.
- Robots-aware live public HTML fetch on example.com succeeded. Anonymous GET/POST company-research endpoints returned 401.
- No personal CV was used for live embedding checks. Hosted SQL application, signed-in end-to-end company research and live RAG fact/coaching generation still require manual acceptance. See docs/COMPANY_RAG.md.

## Adaptive Learning Roadmap - 2026-10-29

- Build/lint passed and 79 TypeScript tests passed. Final focused learning tests passed after bounding fallback topic lengths. Existing company/CV/job tests remain in the suite.
- Isolated PostgreSQL tests passed for roadmap save/retrieve, status/evidence persistence, regeneration preserving completed tasks, stale-tab conflicts, atomic rollback, cross-user RLS, foreign CV rejection, anonymous denial and migration rerun.
- Anonymous GET/POST /api/learning returned 401 on the production build.
- Live structured AI generation with a synthetic profile returned a valid one-week roadmap with two tasks totalling 102 minutes for a two-hour budget. No personal CV data was sent.
- Hosted migration and signed-in end-to-end acceptance remain manual. See docs/LEARNING_ROADMAP.md.

## 2026-10-29 � restored application tracker

- Full TypeScript suite: 84 tests passed, including selected CV-version ownership and tracker URL validation.
- Local isolated PostgreSQL: create, edit, stage transitions, history retrieval, duplicate rejection, foreign CV/report rejection, cross-user reads/updates/deletes, anonymous access denial, deletion cascade and migration rerun passed.
- Typecheck, ESLint and production build passed. Build encoding issue corrected to UTF-8.
- Hosted migration and signed-in drag/drop, keyboard/mobile workflow remain manual checks. See APPLICATION_TRACKER.md.

## 2026-10-29 — job-specific CV tailoring

- 87 TypeScript tests passed; focused tailoring/upload tests rerun with version lineage assertions.
- 7 real PyMuPDF editing/export regression tests passed.
- Isolated PostgreSQL tests passed for accept/reject persistence, immutable results, foreign ownership rejection, new CV lineage, original preservation, migration reruns and source/job deletion behavior. A foreign-key trigger ordering issue found by the added deletion test was fixed and rechecked.
- Typecheck, lint and production build passed.
- Hosted migration and live OpenRouter/signed-in browser export workflow remain manual. See CV_TAILORING.md, including conservative extractive wording limits.

## 2026-10-29 — career readiness analytics

- 93 TypeScript tests passed, including metric arithmetic, selected role gaps, owner scoping of both initial/dependent queries, private CV text exclusion, empty/partial-data states and rendered loading accessibility.
- Typecheck, ESLint and production build passed.
- No schema changes, write operations or new AI calls. Existing RLS and server-side page authentication are reused.
- Mock interview scores are explicitly unavailable because no scored session data exists. Signed-in visual checks at mobile/tablet/desktop widths remain manual; see CAREER_ANALYTICS.md.

## 2026-10-29 — production readiness upgrade (Step 26)

Actual local results after fixes and dependency updates:

| Validation | Result |
| --- | --- |
| TypeScript unit/regression/security suite | 99 passed |
| Typecheck / ESLint / production build | Passed (final build checked before commit) |
| Python unittest discovery | 17 passed, including PDF export and private-service guards |
| pip check | No broken requirements |
| npm audit | 0 vulnerabilities after dependency upgrades |
| pip-audit -r matching-service/requirements.txt | No known vulnerabilities after FastAPI/Starlette upgrade |
| PostgreSQL suites | All eight passed: CV v2, hybrid, GitHub, RAG, learning, tracker, tailoring, production security; migration reruns included |
| Playwright desktop/mobile | 4 passed, 4 skipped (dedicated E2E_EMAIL/E2E_PASSWORD absent); skipped flows are authenticated tracker CRUD and CV upload/download/dashboard |
| Client secret scan | 57 generated client files checked against 3 configured private values; no matches; values were not printed |
| Offline labelled ranking | Mean Recall@3=1.000, NDCG@3=1.000 on three synthetic profiles |
| Live semantic labelled ranking | Mean Recall@3=1.000, NDCG@3=1.000 on the same tiny synthetic dataset; not evidence of real-world ranking accuracy |
| Live structured AI | One synthetic learning plan passed schema/workload checks: one week, two tasks, 100 minutes |
| Live embedding sanity | 1536 dimensions; relevant cosine 0.727 versus unrelated 0.121 |
| Public GitHub smoke | octocat public profile/repository and README read successfully; zero partial warnings |
| Public job-source smoke | IFS Sri Lanka: 3 normalized listings/official links; IFS India: 0 current results; Jobicy: FAILED (overall source-check command exited 1) |

Initial issues found and corrected: Supabase SSR/client type mismatch after patching; Zod v4 partial defaults resetting application status; SDK custom tool-call union validation; Starlette dependency advisories; new helper return typing. The raw `node scripts/evaluate-jobs.ts` invocation failed module resolution and was rerun successfully through tsx (now `npm run test:ranking`). A local semantic-service attempt could not reach the provider inside the sandbox; the verified temporary localhost server was restarted with outbound access and the full semantic evaluation then passed. Temporary test services were stopped.

Remaining release gates: hosted security migration and Supabase Auth/RLS/private-bucket verification, dedicated-account E2E including two-account private file isolation, production Vercel/Render target approval/access, live staging acceptance, monitoring, retention and backup restoration. No hosted data was changed and no deployment was performed. Jobicy availability remains a partial external-source failure; do not describe that smoke check as fully passing. CI workflow was added but not run on GitHub in this session.

## Step 27: Requirements-first job discovery

104 TypeScript tests passed; all 11 focused hybrid tests passed after the final location fallback adjustment. ESLint passed. The offline three-profile synthetic dataset returned mean Recall@3=1.000 and NDCG@3=1.000; this does not establish live ranking accuracy. No hosted SQL or data was changed. Authenticated browser verification and confirmation of individual source listings remain manual.

Manual acceptance: save a target role, two preferred locations, work mode and salary range in Find Jobs. Confirm a refreshed search, per-requirement explanations, unknown salary/location labels, and the optional mismatch toggle. Confirm broad country listings do not claim to verify a specific city. Existing CV and company workflows are covered by the full regression suite.
Production build passed, including TypeScript validation and generation of all 23 static pages. An accidentally duplicated build was stopped after a shared webpack cache warning; the retained build completed successfully.

## Step 28: Multiple-company public job discovery

108 TypeScript tests passed; ESLint passed. Four new tests cover multi-company RSS metadata, location uncertainty, unsafe/malformed feeds and employer fetch allowlisting. Live read-only smoke test: ITPro returned 25 internship listings from 23 distinct companies; LinkedIn employer India and Bosch India returned zero internship candidates in the bounded snapshot. These are feed counts, not counts guaranteed to match a particular CV/preferences. No hosted SQL/data was changed. No comprehensive LinkedIn platform search was implemented. Manual authenticated browser verification remains outstanding.
Production build passed, including type validation and generation of all 23 static pages.
