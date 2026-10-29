# Career readiness analytics

Open **Career readiness** (`/dashboard`) after signing in. The default CV-first landing page and existing feature pages remain unchanged. No new database tables, migrations, API keys or AI requests are needed.

## Widgets and evidence

- Latest CV's saved v2 quality review with five categories, basis and explanations; v1 fallback is labelled legacy. V2 input hashes are compared on the server to flag stale text. The CV text is never sent to the dashboard client.
- CV-detected skills and GitHub skills approved by the user for that CV. Approval is self-reported, not independent verification of proficiency.
- Required/preferred missing skills selectable by role from recent matches for the current CV. Older-CV results remain visible in the match history with a warning, but do not contribute to current skill gaps.
- Up to eight deduplicated job relevance scores from the latest three saved matching runs. These are not hiring probabilities; openings may no longer be available.
- Latest roadmap version's completed/in-progress task counts and percentage. Earlier versions remain in Learning. Completion does not prove mastery.
- Mock interview performance has an explicit unavailable state: the existing application has preparation material, but no scored mock-session records. No history or scores are invented.
- Exact current counts for all seven application stages. A failed count is Unknown, not zero; these are current-state counts, not a conversion funnel.
- A sampled recent activity timeline, not a full audit log.
- Personalized deterministic next actions, separate from previously generated AI CV advice. No synthetic overall career-readiness score is calculated.

## Implementation

`src/lib/analytics/service.ts` reads existing Supabase tables with the authenticated server client and explicit user filters. Independent bounded queries run in parallel; CV approvals and latest-plan tasks are fetched only after their IDs are known. Stage counts use exact head-only requests so they are not truncated by Supabase's default row limit. No mutation or cross-user cache is introduced. `/dashboard` is dynamically rendered behind the workspace auth boundary and `requirePageUser`.

`metrics.ts` contains pure calculation helpers. `readiness-dashboard.tsx` renders responsive cards and native meter/progress charts with text labels. Role filtering is local; it performs no network requests. Loading and route-error boundaries provide accessible states. Widget-level database errors leave other available data visible.

Freshness timestamps are UTC. Records older than seven days are flagged as old; newer records are still snapshots, not live evidence. Refreshing the dashboard rereads saved data. Generate a fresh analysis in the source feature when the underlying CV, preferences or job has changed. Job-match cache context changes beyond CV identity are not revalidated here.

## Run and test

1. `npm run dev`, sign in, then open `/dashboard` or Career readiness in the navigation. Existing feature migrations must already be installed; no additional SQL is required.
2. `npm run test`, `npm run lint`, `npm run build`.
3. On an empty account verify meaningful CV/job/learning/interview/activity empty states and zero application counts. Unknown/failing data should show warnings instead.
4. On a populated account compare each widget against CV Profile, Find jobs, Learning and Applications. Switch the target-role menu and confirm required/preferred gaps change. Accept a GitHub skill for the latest CV and refresh.
5. Mark one task completed, move one application stage, and refresh. Counts and timeline should update. Upload a new CV: older job matches/roadmaps should be labelled and current gaps should no longer use them.
6. Sign out: dashboard access redirects to login. Sign into another account and verify the first account's data is absent. Existing RLS remains in force.
7. At 375px, 768px and desktop widths verify cards reflow, long labels remain readable, charts fit and the role select works by keyboard/touch. Use slow-network throttling to check loading status and retry behavior.

Automated tests cover metric arithmetic, role filtering, stale timestamps, owner filters on every query, partial failures, rendered empty states and loading accessibility. Signed-in browser/viewport checks are manual; markup tests are not a substitute for real-device layout validation. No new mock-interview feature or scoring system is included.
