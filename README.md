# AI Internship Copilot — Step 1

Email/password authentication and a private application tracker using Next.js App Router, TypeScript, Tailwind CSS, and Supabase. This step needs no AI API key. The dashboard adds, lists, changes status, and deletes applications.

## Build roadmap

The full app will compare a student's CV with a job post, show a match score and missing skills, draft tailored bullets and an application email, and track applications. We are completing the steps in order; see [implementation progress](docs/PROGRESS.md) for status and planned folders. Steps 2–6, including FastAPI, tool calling, and deployment instructions, are pending.

This folder already contained an app. The Step 0 Git snapshot preserves that starting code, including earlier prototype files; it does not mean their later-step features have been verified.

## 1. Install and configure

Use Node.js 22 or newer. In PowerShell, use `npm.cmd` if `npm` is blocked by the script execution policy.

```powershell
npm.cmd install
```

A blank `.env.local` has been created. Fill in your Supabase project values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Get these from your Supabase project's Connect dialog / API settings. Use the public anon key, never a service role or secret key. `.gitignore` ignores `.env.local`; `.env.example` is the shareable blank template. Next.js reads `.env.local` automatically. Restart the dev server after changing it.

## 2. Create the applications table

Open Supabase **SQL Editor**, create a query, paste the entire contents of `supabase/migrations/20261026000000_step1_applications.sql`, and run it.

For Step 1, run only this SQL file. It works on a fresh project and also upgrades the earlier prototype applications table without deleting its rows. It creates the requested `id`, `user_id`, `company`, `role`, `status`, `job_text`, `match_score`, and `created_at` columns, plus an ownership index and Row Level Security. `job_text` is optional in the form and stored as an empty string if omitted. `match_score` is nullable until Step 4 calculates it; scores must be integers from 0 to 100. If you ran the earlier Step 1 SQL, run this updated file again to add `match_score` safely.

RLS permits authenticated users to select, insert, update, and delete only their own rows. Updates cannot transfer a row to another user. API routes also check the user, set `user_id` on the server, and filter by ownership.

## 3. Configure Supabase Auth

Enable the Email provider with password login in Supabase Authentication. Keep email confirmation enabled if you want verified signups.

Under Authentication → URL Configuration, set:

- Site URL: `http://localhost:3000`
- Redirect URL: `http://localhost:3000/api/auth/callback`

The signup page redirects confirmation links to the callback route, which exchanges the code for a session. Open the email link in the same browser used to sign up, because the confirmation flow uses that browser's verifier cookie. If confirmation is disabled, signup logs in immediately. Otherwise, check your inbox (and spam) and confirm before logging in. Provider email limits may apply during repeated signup testing.

## 4. Run

If an error points to `createServerClient` in middleware, check that `NEXT_PUBLIC_SUPABASE_URL` is the actual full Project URL beginning with `https://`, copied from Supabase. A project name or placeholder such as `your-project-url` is not a URL. The app now checks the URL before creating its clients and redirects to a setup message for missing or malformed configuration. Restart the server after correcting `.env.local`. A correctly formatted URL and nonempty key still need to belong to a real Supabase project.

```powershell
npm.cmd run dev
```

Open `http://localhost:3000/signup`. Routes:

Development uses `.next-dev` and production builds use `.next`, so running a build cannot overwrite an active development server's generated files. After pulling this configuration change, restart `npm.cmd run dev` if your terminal does not restart automatically.

- `/signup`: email/password registration
- `/login`: email/password login
- `/logout`: logout form; the dashboard also has a Log out button
- `/dashboard`: protected application tracker
- `/applications`: redirects old bookmarks to `/dashboard`

Session cookies are refreshed in Next.js 15 middleware. Both the dashboard page and its layout verify the current user with Supabase. Without configured keys, a setup message is displayed and no application data is loaded.

## 5. Test the acceptance criteria

1. Visit `/dashboard` while logged out; expect a redirect to `/login` once Supabase is configured.
2. Sign up using a real email and a password of at least 8 characters. Confirm your email if enabled. Log in.
3. Add company `Example Ltd`, role `Software Intern`, status `Applied`, and an optional job post. Expect the saved row in the list.
4. Change status to `Interview`. Expect “Status saved.” Refresh the browser; the row must still show `Interview`.
5. Log out and log back in. The application should still be there.
6. In a private browser window, register a second user. Its dashboard must be empty. Add a separate application; the first user's list must not change.
7. To verify API ownership, while logged in as the second user, send PATCH/DELETE requests to `/api/applications` using the first user's application ID. Both should return 404 and leave that row unchanged. An invalid status returns 400.
8. Delete an application, accept the confirmation, and refresh; it must remain deleted.
9. Log out and visit `/dashboard` again; expect `/login`. Calling `/api/applications` while logged out returns 401 when configured.

Validation commands:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

Real signup, persistence, and RLS checks require your configured Supabase project and the SQL above. The repository contains earlier prototype CV/AI files; they are not part of this step and are not linked from the Step 1 UI.

**Current pause:** both Supabase environment values are blank. Create or choose a Supabase project, fill in `.env.local`, run the updated Step 1 SQL, and configure the callback above. Then run acceptance checks 1–9. Tell me when these are done (or share the error text) so we can finish Step 1 validation before implementing Step 2. Do not paste secret keys into chat.

## Files for Step 1

- `src/lib/supabase/client.ts`, `server.ts`: cookie-based browser/server clients
- `src/middleware.ts`: session refresh
- `src/components/auth-form.tsx`: signup/login form
- `src/app/login/page.tsx`, `signup/page.tsx`: existing auth page entry points
- `src/app/api/auth/callback/route.ts`: existing email confirmation callback
- `src/app/logout/actions.ts`, `page.tsx`: logout
- `src/app/(workspace)/layout.tsx`: protected workspace
- `src/app/(workspace)/dashboard/page.tsx`: authenticated database read
- `src/app/(workspace)/applications/page.tsx`: redirect to dashboard
- `src/components/app-shell.tsx`: simple header and logout button
- `src/components/application-tracker.tsx`: add/list/status/delete UI
- `src/app/api/applications/route.ts`: authenticated database writes and listing
- `src/lib/applications.ts`, `src/types/database.ts`: validation and database types
- `supabase/migrations/20261026000000_step1_applications.sql`: table and RLS SQL
- `package.json`, `package-lock.json`, `postcss.config.mjs`: dependencies and Tailwind setup
- `eslint.config.mjs`: compatible ESLint configuration for Next.js 15
- `src/app/(workspace)/analyze/page.tsx`: corrected an existing state-setter type so the project compiles; no AI features added
- `.env.local`, `.env.example`, `.gitignore`: local configuration and secret exclusions

Implementation follows the [Supabase SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).
