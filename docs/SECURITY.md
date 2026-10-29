# Security review and production gate

Scope: repository APIs, auth/session helpers, user-data flows, supported SQL policies/RPCs, public URL retrieval, AI/schema/tool integrations, private PDF storage/editing, dependencies and deployment configuration. This is a code/test review, not a third-party penetration test or inspection of your hosted Supabase project.

## Findings addressed

| Finding | Change / evidence |
| --- | --- |
| Legacy analyze/match/agent calls had no persistent quota | Additive paid-operation RPCs: ten attempts/user/hour across these endpoints, one active lease, 15-minute identical-input cache, one-minute failed-request cooldown. No automatic paid retries. SQL owner/cache tests. |
| New pages missing session-refresh middleware | GitHub/Learning/Tailoring and API paths added; APIs still verify getUser independently. |
| Cross-origin API mutations accepted | Reject foreign Origin before API processing; authenticated origin-less CLI supported. Browser tests cover rejection. |
| Request size checked only after parsing | Stream-bounded JSON/form readers; FastAPI checks key before reading and caps bodies before Pydantic. |
| Private service redirects could forward credentials | Matching/PDF fetches reject redirects. Existing RAG/rank/GitHub/feed fetches already reject or safely validate redirects. |
| Raw validation/error data risk | Generic FastAPI validation responses omit input; application error handling reuses sanitized API errors; logs contain only allowlisted event/status/duration. Render access logging disabled. |
| Known dependency advisories | Patched Supabase JS/SSR, Zod, OpenAI SDK, PostCSS override, FastAPI and Starlette. Zod v4 default behavior fixed so PATCH does not accidentally reset stage/job text. |
| CV row could reference an unexpected storage prefix | New NOT VALID owner-path constraint plus download/delete prefix checks; old rows are not rewritten. Existing storage RLS remains enforced. |
| Changed job/CV could retain derived preparation | Clear derived results when source fields change; matching/preparation save guards reject a concurrently changed job/CV selection. |
| Secrets accidentally configured as public | Prebuild variable checks reject known service-role/secret keys; configured private values scanned against generated client assets without printing values. |

## Existing controls retained

- Authenticated Supabase client and explicit owner filters; no service-role bypass in app routes. RLS on private tables and user-prefixed private CV bucket paths.
- PDF MIME, magic header, 4 MiB byte limit, readable-text limit, safe parser teardown; original-preserving editor and unique version paths.
- Company URL HTTPS-only, private/reserved IP rejection, all-address DNS validation, pinned connections, redirect revalidation, publisher/robots restrictions, byte/time/page limits. No LinkedIn/Indeed/Glassdoor scraping.
- Untrusted CV/site/README text remains data in system instructions. Structured outputs use schemas; quoted company/CV evidence is validated. Tool calls have a fixed allowlist, bounded loop, no arbitrary IDs and no email-sending tool. These reduce prompt injection; they cannot prove factual correctness of every generated sentence.
- Feature-specific quotas remain for CV review, jobs, RAG, GitHub, learning and tailoring. Not every feature has durable deduplication; failed/crashed provider requests can still cost money. Configure provider spending caps.
- FastAPI CORS is deliberately absent: only Next.js should call it using a secret. No browser origin is authorized. CORS alone is not a firewall.

## Logging, deletion and retention

Do not log CV text, prompts, model output, passwords, API keys, authorization headers, cookie values or confirmation query strings. The new safe logger accepts only an event enum, numeric status and elapsed milliseconds. Review hosting/platform log retention and disable body capture in any future monitoring integration. Uptime checks should call liveness endpoints without spending AI credits.

Storage deletion and row deletion are not atomic. A database failure after successful file removal may leave a missing-file row; retry the owned deletion and reconcile storage/DB with an operator. Never delete another user's object to repair a mismatch. Deleting a CV does not mean all derived reports/learning records vanish: some retain snapshots with null source references. Public RAG chunks survive report deletion. There is no complete account-erasure UI; operators must include storage and derived data in an approved erasure workflow.

Paid-operation results are private to the user via RPCs, reusable for 15 minutes, and pruned after 24 hours on that user's next operation. Inactive users' expired rows need a scheduled operator retention job; expiry is not automatic deletion. Do not claim strict 24-hour data retention until that schedule is configured.

## Hosted verification required before release

1. Confirm every supported migration was applied and public tables have RLS enabled. Inspect `pg_policies`; compare with supported migration files. SQL Editor admin access bypasses RLS, so also test two real accounts.
2. Confirm bucket `cvs` is private, PDF-only, 4 MiB, with only owner-prefix policies. Anonymous object URLs must fail.
3. Confirm email confirmation/SMTP, exact HTTPS auth callbacks, secure account recovery and Supabase auth rate limits. Avoid wildcard production redirect URLs.
4. Verify public variables contain only public keys. Keep provider/shared service tokens in Vercel/Render secret settings; use separate staging/production credentials and rotate exposed values.
5. Test two-account IDs against CV download, application, review, tailoring and roadmap APIs. Run authenticated Playwright cases with dedicated accounts.
6. Configure billing caps, monitoring/alerts, retention and backups. Backups may require separate storage-object backup coverage; verify restoration before release.

The new security migration is additive and does not remove application/CV rows. Broad ownership policies intentionally allow students to edit their own records, so user-stored scores/approvals are not tamper-proof credentials.
