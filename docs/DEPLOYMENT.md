# Deploy to Render and Vercel

The repository is ready to deploy. No service has been published and no account settings have been changed automatically.

## 1. Supabase

1. Create or choose a project. Run the entire `supabase/setup.sql` in SQL Editor. It creates/upgrades `applications`, `cvs`, ownership RLS, and a private `cvs` PDF bucket. Do not run the old `20261020000000_initial_schema.sql` after setup; it belongs to the earlier prototype. For a CLI migration workflow, baseline that historical migration in an existing project first; the supported hand-setup path is `setup.sql`.
2. Enable email/password signups. For local work set Site URL to `http://localhost:3000` and allow `http://localhost:3000/api/auth/callback` as a redirect. Confirm emails using the same browser and computer as signup, with the local server running. Resend confirmation from the app if a link expired.
3. After deploying Vercel, change Site URL to the production HTTPS origin and add `https://YOUR_DOMAIN/api/auth/callback` to redirect URLs. Keep the localhost callback if you still develop locally. Add preview callbacks individually if you test preview environments.
4. Copy the project URL and public publishable/anon key from Connect. Our existing env variable is named `NEXT_PUBLIC_SUPABASE_ANON_KEY`; it also accepts a publishable key. Never use a service-role/secret key there.

## 2. Push your repository

Create a private or public Git repository on your chosen Git host and push the local commits. `.env.local`, `matching-service/.env`, caches, dependencies, and virtual environments are ignored. Review staged files before pushing. No remote or push is configured automatically.

## 3. Render: FastAPI

Create a Python Web Service from the repo (or use the root `render.yaml` blueprint).

| Setting | Value |
| --- | --- |
| Root directory | `matching-service` |
| Build command | `pip install -r requirements.txt` |
| Start command | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Health check | `/health` |
| Python | 3.13; root `.python-version` selects its latest patch |

Set these env variables in Render:

- `OPENAI_API_KEY`: your API key with embedding access and billing enabled
- `EMBEDDING_MODEL`: `text-embedding-3-small`
- `MATCHING_SERVICE_API_KEY`: the same random shared key used in Next.js
- `MATCH_THRESHOLD`: `0.65` initially; tune with representative CV/job examples

Deploy and visit `https://YOUR_SERVICE.onrender.com/health`; expect `{"status":"ok"}`. An unauthenticated POST to `/match` must return 401. This health check verifies server readiness, not your embedding key/billing. Copy the service HTTPS origin for Vercel. A sleeping/cold service may need warming before an agent run.

These commands follow the [Render FastAPI guide](https://render.com/docs/deploy-fastapi); Python version selection follows [Render's version documentation](https://render.com/docs/python-version).

## 4. Vercel: Next.js

Import the same repo, choose the Next.js preset, repository root as Root Directory, and Node.js 22 or newer. Use `npm ci` and `npm run build`; leave the output directory at Next.js defaults. Production uses `.next`; local development uses `.next-dev`.

Set all six variables from the root `.env.example`:

1. `NEXT_PUBLIC_SUPABASE_URL`
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. `OPENAI_API_KEY`
4. `OPENAI_MODEL=gpt-4o-mini` (or a model supporting strict structured output and function calls)
5. `MATCHING_SERVICE_URL=https://YOUR_SERVICE.onrender.com`
6. `MATCHING_SERVICE_API_KEY` (identical to Render)

Deploy, add the production Supabase callback as above, and redeploy after changing public env values because Next.js bundles them at build time. Use Vercel's Fluid Compute / a function duration setting supporting the agent route's `maxDuration=300`. The API uses Node.js functions, not the Edge runtime.

The app limits PDFs to 4 MB to fit below [Vercel's 4.5 MB function payload limit](https://vercel.com/docs/functions/limitations). The same documentation lists function-duration limits; check the limits enabled for your account. Deployment follows [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs).

## 5. Production acceptance test

1. Signup/confirm/login from the deployed origin; ensure redirects stay on that origin.
2. Add/change/delete an application and refresh to verify persistence.
3. Upload a PDF, inspect text/skills, replace it, and verify private file ownership with another account.
4. Analyze a job, save it, and run **Check CV match**.
5. Run **Prepare my application**. Expect five tool names in stored results, a score, exactly three bullets, and an email. Refresh, copy drafts, review facts/placeholders, and verify no email is sent.
6. Use a second account and attempt requests with the first account's application/CV IDs. Expect 404; personal data must not be returned. SQL Editor admin queries bypass RLS, so they do not prove end-user isolation.

Live provider results, email delivery, hosting URLs, and billing access require your own accounts and keys. No live deployment or end-to-end authenticated test has been claimed by the offline checks.
