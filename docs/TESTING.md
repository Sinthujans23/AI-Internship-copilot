# Testing guide

## Local checks

- `npm ci`; `npm run typecheck`; `npm run lint`; `npm run test`; `npm run build`.
- `npm run check:secrets` after build. Reads local env only to compare private values with client assets; never prints them. This does not scan git history or replace a dedicated secret-scanning service.
- `npm audit` checks current npm advisories. The PostCSS override is pinned intentionally; review it with future Next.js updates.
- In matching-service: `python -m unittest discover -p "test_*.py"`, `python -m pip check`, and `python -m pip_audit -r requirements.txt` (install pip-audit into the local venv first).
- `npm run test:ranking` runs the small labelled offline skill/preference baseline. Perfect synthetic metrics do not establish real-world ranking quality. Live semantic/provider checks are separate and may cost credits.

## SQL ownership/regression tests

Start Docker Desktop. Each invocation starts and removes a temporary local Postgres container with synthetic records, no published ports and no hosted credentials:

```text
node scripts/test-cv-v2-db.mjs
node scripts/test-cv-v2-db.mjs --hybrid
node scripts/test-cv-v2-db.mjs --github
node scripts/test-cv-v2-db.mjs --rag
node scripts/test-cv-v2-db.mjs --learning
node scripts/test-cv-v2-db.mjs --tracker
node scripts/test-cv-v2-db.mjs --tailoring
node scripts/test-cv-v2-db.mjs --production
```

These simulate Supabase auth.uid()/roles; they do not reproduce hosted Storage or Auth infrastructure. Use the two-account production acceptance checklist too.

## Playwright

`npx playwright install chromium`, then `npm run build` and `npm run test:e2e`. A temporary production Next.js server starts at 127.0.0.1:3100 and stops afterwards. Do not run another server on that port. Desktop and Chromium mobile emulation check login/signup layout, anonymous route guards, health, headers and hostile-origin rejection.

For authenticated tests set E2E_EMAIL and E2E_PASSWORD in the test process for a dedicated confirmed account in a staging project. No test credentials are stored in source. Tracker CRUD and synthetic PDF upload/download/dashboard tests skip explicitly when these variables are missing. They clean up only records they create; interrupted runs may leave clearly named synthetic fixtures. Traces/screenshots/video are disabled to avoid retaining private content. Do not run these against a personal or production account.

AI failures, schema validation, prompt-injection/evidence filtering, CV upload, job discovery, company extraction, PDF export, RLS and tool-loop regression cases are also covered by lower-level TypeScript/Python/SQL tests. Browser tests do not call paid AI providers by default. CI uses placeholder public configuration and runs only anonymous browser workflows unless separately configured.

## Remaining manual checks

Provider billing/model access; real confirmed email login; two-user storage isolation; live public-source availability; PDF rendering on representative supported/unsupported CV layouts; authenticated desktop/mobile feature flows; Render cold starts; Vercel limits; production monitoring and backup restoration. Report skips and limitations explicitly. See VALIDATION.md for actual run results, not expected outcomes.
