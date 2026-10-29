# Deploy, monitor and roll back

Deployment configuration is prepared; no service was published and no hosted Supabase setting was changed by this upgrade. Use staging first. Have the project owner confirm target Vercel/Render projects and production changes; enter secrets directly in their dashboards, never in chat.

## 1. Database and backups

Back up the production database and verify storage-object backup/restore coverage. Apply missing supported migrations in order. Existing installations need `supabase/migrations/20261030000000_production_security.sql`; new projects use `supabase/setup.sql`. Do not reapply the obsolete prototype migration. The new path constraint is NOT VALID to preserve existing rows; investigate mismatched legacy paths before validating it. Run the hosted checklist in SECURITY.md.

## 2. Render private service

Use `render.yaml`: Python service, root `matching-service`, `pip install -r requirements.txt`, `uvicorn main:app --host 0.0.0.0 --port $PORT --no-access-log`, health path `/health`. `.python-version` selects Python 3.13. Use the patched requirements file, not a stale build cache. Configure AI_PROVIDER, its selected provider key/embedding model, MATCH_THRESHOLD and a long random MATCHING_SERVICE_API_KEY. The Next.js copy must match. No CORS origins are needed; all requests are server-to-server. Docs/OpenAPI routes are disabled.

Verify `/health` returns 200 and unauthenticated `/match`, `/rank`, `/embed`, `/pdf/edit` requests fail. A 200 health response proves only process liveness, not AI billing or database access. See the official [FastAPI deployment guide](https://render.com/docs/deploy-fastapi) and [health-check behavior](https://render.com/docs/health-checks).

## 3. Vercel

Import the repository root using Next.js and Node 22. `vercel.json` uses `npm ci` and `npm run build`; production output is `.next`. Configure all required variables in SETUP.md and set MATCHING_SERVICE_URL to the Render HTTPS origin. Choose a model supporting structured output/tools and an embedding model available to the service. New public Supabase values require rebuilding.

Route maxDuration values remain in source (up to 300 seconds for the agent). Verify your plan's enabled function duration/memory limits. PDF uploads are capped at 4 MiB with bounded multipart overhead; large files may need a future direct-upload design. Vercel documents a [4.5 MB request/response limit](https://vercel.com/docs/functions/limitations), so test representative PDFs in staging, including edited response size. Health is `/api/health`.

## 4. Supabase production settings

Set Site URL to the production HTTPS origin and add its exact `/api/auth/callback` redirect. Configure SMTP/confirmation, auth rate limits, private storage and RLS. Add development/preview redirects deliberately, never a broad production wildcard. Use public anon/publishable keys in NEXT_PUBLIC variables only; service-role keys are not required. Inspect bucket/policy state in the actual dashboard; repository tests cannot certify it.

## 5. Acceptance and monitoring

Run build/lint/unit/Python/SQL/browser suites. Then run authenticated E2E on staging with a dedicated account and manually check two-account ownership, real AI/schema support, PDF preview/export, public-source partial failures and quota/cache behavior. Set provider budgets. Configure uptime checks for both health endpoints and alerts for HTTP 5xx/429 spikes, latency, failed saves and sustained dependency outages. Structured app logs contain only event/status/duration; do not enable request-body capture.

No synthetic health call spends AI credits. Live paid smoke checks require a deliberately selected low-cost fixture and confirmation that billing is enabled. Schedule expired private-cache cleanup if strict retention is required.

## Rollback

1. Stop/promote away from the failing release using the host's previous successful deployment. Roll back Vercel and Render to compatible known commits; record the commit and env-version identifiers beforehand.
2. Retain additive database tables/columns/indexes. Do not drop user data to revert code. Previous code can ignore new objects. If a new constraint blocks legitimate legacy records, investigate first; a controlled forward migration is safer than destructive rollback.
3. Restore provider/model/env settings only if known compatible; rotate compromised secrets instead of restoring them. Rebuild Next.js when public env settings change.
4. Recheck liveness, authenticated login, owned read/write, PDF access and quotas. Restore backups only through an approved incident procedure; doing so can lose newer writes.
5. Record cause, affected time window and any partial storage/database operations needing reconciliation.

Deployment remains pending until project access, configured secrets and explicit production approval are available. Never represent local test success as a successful deployment.
