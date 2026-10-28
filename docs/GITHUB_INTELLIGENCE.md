# GitHub Project Intelligence and Skill Verification

Visit **GitHub intelligence** (`/github`) in the authenticated workspace. Enter a GitHub username, browse public repositories, and choose **Analyze project**. The feature identifies repository evidence, not a verified proficiency level or verified account ownership. No OAuth connection is required in this version.

## Setup

1. Run `supabase/migrations/20261028020000_github_intelligence.sql` in the Supabase SQL Editor. It creates `github_analyses`, `github_skill_approvals`, and the atomic request-limit RPC. Existing CV/review/job tables are not changed. Fresh installations can use `supabase/setup.sql` instead.
2. Restart Next.js with `npm.cmd run dev`. Existing OpenRouter/OpenAI configuration is reused for AI-assisted document review. AI failure falls back to deterministic evidence.
3. Optionally set `GITHUB_TOKEN` in `.env.local` to increase the GitHub API allowance. Keep this server-only; never use `NEXT_PUBLIC_GITHUB_TOKEN` or paste the token into the UI. Public access without a token is supported. No private-repository access is needed.
4. Upload a CV in CV Profile to enable comparison and skill approval. GitHub repository analysis itself works without a CV.

The current FastAPI matching/PDF service remains unchanged. GitHub API requests and structured AI analysis run in the existing Next.js backend; no new Python service or dependency is needed. Existing CV and job matching inputs are preserved.

## What is inspected

- Official GitHub REST API: public user repositories, repository metadata, languages, README and root contents. Repository list pagination is 30 rows/page, with an explicit Load next page button and a 100-page safety cap.
- Up to four selected root files: `package.json`, `requirements.txt`, `pyproject.toml`, `Dockerfile`, `Cargo.toml`, `go.mod`, `pom.xml`, `composer.json`, `Gemfile`, `pubspec.yaml`, in that priority order when present.
- File API payloads are capped at 64 KB; decoded text is limited to 32,000 characters. AI sees up to 14,000 README characters and the repository description, never CV text. API responses are streamed with a two-MB bound and 12-second timeout. Analyze endpoint allows up to 120 seconds; deployment must support this duration.
- Node dependencies are read from dependency/devDependency/peerDependency keys. Other manifests use conservative declaration patterns and a finite technology mapping. Docker detection requires a FROM instruction. No code, build scripts, packages or README commands are executed. Nested monorepo manifests, lockfiles and transitive dependencies are not inspected.

Repository language bytes, declared dependencies and README mentions are labelled separately. A package declaration does not prove it is used at runtime. A README claim is documentation, not execution evidence. Forks/archived repositories are flagged. No commit authorship investigation or assessment of personal implementation takes place.

AI chooses exact source quotes for purpose/documented functionality and future improvement checklist categories. Zod validates its response; quotes absent from the supplied source are discarded. The AI cannot add technology evidence, metrics, personal achievements or approved skills. Deterministic project-reference drafts intentionally avoid “I built/implemented” claims. Improve these drafts with your own confirmed contribution before using them in a CV.

## CV and application workflow

1. Analyze a project and inspect its evidence.
2. Compare against the latest owned CV. Shared technologies, repository technologies missing from the CV, and CV skills without evidence in this repository are listed. Missing repository evidence does not disprove a CV skill.
3. Optionally paste job requirements. Saved projects are sorted by shared recognized technologies, with the overlapping skills displayed. This is a simple project relevance aid, not semantic job scoring or proof of eligibility. The existing hybrid Find Jobs engine remains available separately.
4. Tick the contribution confirmation and approve each skill you personally used and can explain. Approvals are saved against the particular analysis and CV version. Revoke them at any time.
5. Copy the project reference and approved skill draft. Review and edit your actual CV manually using CV Profile/PDF editor. **Approving never changes the PDF or automatically inserts skills into matching inputs.** Uploading a new CV creates a new comparison; old approvals remain attached to the older CV version.

Approved here means student-approved draft, not independently verified ability. This distinction prevents public repositories, templates or forks from silently inflating matching scores.

## Persistence, caching and privacy

Repository metadata and fetched public evidence use a one-hour Next.js cache. Analyses are private, per-user snapshots with analysis/fetch timestamps; up to 30 recent analyses are displayed. Recent identical snapshots are reused for an hour, including partial/AI-fallback reviews. Repository public visibility is checked afresh before Analyze can use a cached review. The public list itself can be stale for the cache interval. Historical snapshots are labelled by timestamp and are not a current visibility or availability guarantee.

The application fetches only fixed `api.github.com` paths assembled from validated username/repository components, rejects redirects, and never follows URLs inside repository text or API-provided download links. Only public repositories belonging to the entered username are accepted, even if a configured token could access private ones. No keys or provider response bodies are logged. README/manifest text is displayed as text, not executable HTML. Repository text is treated as untrusted AI input, with no tool execution. Do not publish secrets in repositories; automated secret auditing is outside this feature.

RLS isolates analyses and approvals by authenticated user. Approvals additionally require an owned CV, an owned analysis and an evidence-backed skill. Server ownership checks precede writes; database policies independently enforce them. Only authenticated requests can read/write dashboard data. Requests to list/analyze reserve a persistent atomic quota of 30/hour/user; GitHub's own shared IP/token rate limit may be reached earlier. Approval/revoke actions do not call GitHub or AI. Old rate reservations are retained; administrators can periodically delete entries older than the rate window. No cleanup of user data occurs automatically.

Private/missing profiles, invalid tokens, denied/rate-limited requests, timeout/invalid response data, empty public profiles, missing READMEs, unavailable manifests and AI failures have distinct or partial-data states. Errors never invent missing evidence. GitHub API details are based on [public repository API documentation](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user) and [repository contents documentation](https://docs.github.com/en/rest/repos/contents#get-a-repository-readme).

## Tests

```powershell
npm.cmd run test
npm.cmd run lint
npm.cmd run build
# Docker Desktop required; isolated synthetic PostgreSQL, no hosted data:
node scripts/test-cv-v2-db.mjs --github
# Optional live public API smoke test, no CV or AI:
node --import tsx scripts/check-github.ts
```

Tests cover username validation, private/foreign/missing repositories, pagination, empty profiles, API failures/rate limits, missing README, selected files only, dependency/language/README extraction, invalid AI output, exact evidence grounding and ownership checks. PostgreSQL integration tests verify save/retrieve, cross-user isolation, foreign CV denial, unsupported skill denial, revocation, anonymous denial, rate limiting and migration rerun. Existing CV/PDF/company/job tests remain in the suite.

Manual acceptance after applying hosted SQL:

1. Load your username; inspect cards and use Load next page on a profile with more than 30 public repositories.
2. Analyze a project. Inspect evidence source labels and quotes. Try a fork and a repository without README.
3. Upload a CV, approve one genuinely used skill, reload, verify persistence, then revoke it.
4. Paste job requirements and confirm projects with overlapping detected technologies sort first.
5. Confirm a second user cannot see your saved analyses/approvals. Check existing CV upload, PDF editing, Find Jobs and company research still function.

Live smoke verification used `octocat/Hello-World`: eight public repositories were returned for that user, README fetched successfully, zero detected technologies and no partial-fetch warnings. Counts can change. No personal CV or repository was sent to AI during automated verification. Hosted authenticated browser acceptance and GitHub-specific live AI generation remain manual.
