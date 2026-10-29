# Adaptive AI Learning Roadmaps

The authenticated **Learning roadmap** dashboard lives at `/learning`. It uses the latest owned CV, available saved job/company gaps, GitHub repository observations and student-approved skill drafts. It does not modify existing CVs, matching scores, company reports or their learning suggestions.

## Setup and use

1. Run `supabase/migrations/20261028040000_learning_roadmaps.sql` in the Supabase SQL Editor. For a fresh installation use `supabase/setup.sql` instead. The migration is safe to rerun and does not delete earlier data.
2. Keep the existing Supabase and OpenRouter/OpenAI environment configuration. No new keys or FastAPI changes are needed.
3. Restart Next.js: `npm.cmd run dev`.
4. Sign in, upload a CV, and open Learning roadmap. Choose a target role, 1–12 weeks, 1–20 study hours/week, and optionally a saved matching result.
5. Generate a roadmap. Read each milestone, topic, deliverable and completion checklist. Save task status, notes/blockers and an optional HTTPS GitHub/project link.
6. Refresh to confirm progress persists. Use **Suggest next steps from saved progress** to request adaptive advice.
7. **Regenerate as a new version** creates a new plan. Use version history to inspect earlier completed work. **Start a separate roadmap** creates a plan without a parent version.

## Context and evidence

The latest CV supplies recognized skills. Matching sources include the three most recent owned discovery runs for that CV (deduplicated jobs) and ten recent company reports. Required and preferred gaps remain separate; legacy company-match gaps are explicitly unclassified. A match older than 24 hours shows a freshness warning. Switching CVs requires selecting a result for the new CV. Check that a selected job still fits your target role: the app does not treat choosing a different role as fresh employer evidence.

If no matching result is selected, the roadmap is general role-focused practice, not a claim about missing employer requirements. GitHub integration is optional: up to ten recent analyses provide language/dependency observations, and up to 100 student-approved draft skills are included separately. Neither is independently verified proficiency. If optional sources cannot load, the UI warns and available CV/matching data remains usable.

AI receives derived skills, selected gaps and bounded task progress, not the full CV text or fetched evidence-link content. User role strings, notes and repository observations are treated as untrusted data. The model cannot modify databases, follow evidence URLs or call tools.

## Structure and workload

Every plan must have the exact requested number of consecutive weeks, 1–3 tasks per week, an observable milestone, a topic, task type, estimated minutes, a concrete deliverable and 2–4 completion checks. At least one task must be a mini-project. Zod validates the output; server checks reject duplicate tasks, invalid week numbering, unsupported resource IDs, generated URLs and explicit mastery/certification/hiring claims. Weekly task estimates must fit within **85%** of available time, leaving a buffer. SQL repeats duration and workload checks during atomic persistence.

Estimates are planning aids, not guaranteed learning times. The AI is asked to start with prerequisites and use narrow practice tasks. If generation fails or validation rejects output, a visibly labelled deterministic plan provides small examples with runnable/worked deliverables, one success/failure case and a written explanation. It uses 75% of the weekly budget. Reduce scope or regenerate if a topic takes longer than expected.

Resources are fixed official links in `src/lib/learning/schema.ts`, verified on October 28, 2026: [MDN](https://developer.mozilla.org/en-US/docs/Learn_web_development), [React](https://react.dev/learn), [Python](https://docs.python.org/3/tutorial/), [TypeScript](https://www.typescriptlang.org/docs/handbook/intro.html), [FastAPI](https://fastapi.tiangolo.com/tutorial/), [PostgreSQL](https://www.postgresql.org/docs/current/tutorial.html) and [Git](https://git-scm.com/docs/gittutorial). AI selects catalogue IDs rather than inventing links. If no suitable resource exists in this small catalogue, no link is supplied. Python's tutorial assumes basic programming knowledge; review the resource's prerequisites. These links are documentation, not employer-endorsed certifications, and future availability is not guaranteed.

## Progress, regeneration and recommendations

`learning_roadmaps` stores immutable plan versions and a source-context snapshot. `learning_tasks` stores each version's independent tasks, status, notes, evidence URL and update timestamp. Status choices are Not Started, In Progress and Completed. Progress percentage and completed milestones derive from task statuses.

Regeneration saves the entire new plan and its tasks in one database transaction. It never deletes, resets, moves or automatically completes old tasks. A parent pointer records the previous version. The generator receives current-parent progress and the latest 40 completed tasks; validation avoids exact repeats against up to 200 recent completed tasks. Older work remains available through paginated version history (20 plans/page). Semantic variations/revision exercises may still repeat a topic. Earlier completed work is viewed in its original version rather than counted as completion of newly generated tasks.

`learning_advice` stores next-step recommendations with a hash of the actual saved statuses, notes, evidence links and timestamps. Advice can start unstarted work, continue in-progress work or propose review/new practice for completed tasks. References must point to owned current-plan tasks and match their actual statuses. Total suggested time must fit the same 85% weekly budget. Unchanged progress reuses stored advice. Editing progress invalidates it; a concurrent edit during generation causes a retry message rather than attaching stale advice. Deterministic suggestions remain available when AI fails.

Follow-up suggestions are separate from the existing timetable; regeneration plans a new version. **Completed is a student self-report, never proof of mastery, authorship or proficiency.** Optional evidence links are saved but never fetched, executed or automatically assessed. No completion marks add skills to a CV or improve job matching scores.

## Authorization and persistence

All routes verify Supabase server-side authentication. RLS isolates plan/task/advice rows by user. Atomic save validates CV and parent-plan ownership; task updates verify ownership independently in server code and SQL. Task content and plan definitions cannot be directly overwritten by authenticated table updates. Progress changes use an expected timestamp, rejecting stale-tab overwrites with a refresh message.

Ten AI generation/advice requests per hour are reserved atomically per user, including failed attempts. Progress saves and unchanged-progress advice cache hits do not consume that quota. Evidence URLs must be HTTPS without embedded credentials; status, length and ownership checks run before persistence. Account deletion cascades learning data. CV deletion preserves historical learning plans and derived context with a null CV reference; it prevents new generation until a current CV exists. There is no automatic plan or request-history retention cleanup in this version.

## Tests

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
# Docker Desktop required; isolated local PostgreSQL with synthetic users:
node scripts/test-cv-v2-db.mjs --learning
# Optional small live AI call using synthetic data only:
node --env-file=.env.local --import tsx scripts/check-learning-ai.ts
```

Tests cover bounded generation, realistic time budgets, schema/resource validation, duplicate completed-task rejection, follow-up/status consistency, unsafe evidence links, ownership, AI failure fallback and progress hashes. PostgreSQL tests exercise real status transitions, evidence/notes persistence, optimistic concurrency, atomic rollback, regeneration preservation, cross-user reads/writes, foreign CV rejection and anonymous denial. Existing company/CV/job tests remain in the regression suite.

Manual acceptance after hosted SQL setup:

1. Generate a two-week plan with two hours/week; confirm each week stays under 102 minutes and includes completion criteria.
2. Mark one task In Progress, add a blocker, save and reload. Then mark it Completed with a project URL; verify persistence.
3. Generate next-step advice and check it reflects those statuses without claiming mastery.
4. Regenerate; confirm the previous version still contains the completed task and evidence. New tasks start Not Started.
5. Save from two tabs: the stale tab must receive a conflict instead of overwriting newer progress.
6. Test with another account; it must not read or update your plan/task IDs. Recheck existing company reports and learning suggestions.

A live synthetic one-week generation passed validation on October 29, 2026: two tasks totalling 102 minutes for a two-hour weekly budget. No personal CV was sent. Hosted SQL application and signed-in end-to-end acceptance remain manual checks.
