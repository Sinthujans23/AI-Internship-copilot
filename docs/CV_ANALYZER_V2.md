# Advanced Explainable AI CV Analyzer v2

## Enable it

1. In your existing Supabase project's SQL Editor, run **`supabase/migrations/20261028000000_cv_analyzer_v2.sql`**. Alternatively rerun the entire generated `supabase/setup.sql`. This creates the history table/functions and archives existing v1 reviews without removing their original fields. Back up production data before applying any schema change.
2. Keep the existing `AI_PROVIDER=openrouter`, `OPENROUTER_API_KEY`, and `OPENROUTER_MODEL` configuration in `.env.local`. No new AI key is needed. Do not put real keys in example files.
3. Restart Next.js with `npm.cmd run dev`, then open `/profile` and log in. The existing `npm.cmd run dev:matching` service is needed for PDF editing and company embedding matching, not this review.
4. Upload a text-based PDF (maximum 4 MB / 50,000 extracted characters) or select **Analyze CV with v2** on an existing CV.

The hosted migration and live authenticated/provider acceptance checks are manual deployment steps; local database tests do not apply this schema to your Supabase account.

## What changed

- Existing extraction still uses `pdf-parse` and destroys its worker. `cv-upload.ts` centralizes the same PDF validation, extraction, skills and storage/database cleanup behavior.
- Uploading an updated CV now keeps older CV rows, files and reviews. The latest CV remains the one used for jobs/company matching. PDF editor saves continue creating new versions. Explicit Delete CV removes that CV, file and its history; the UI asks for confirmation.
- `/api/cvs/review` POST validates authentication before body processing, scopes CV access to the user, caps request JSON at 2,048 characters, validates CV text size, reserves an analysis, evaluates and saves it. GET returns at most 50 history entries for the owned CV.
- `cv_analysis_history` stores version, rubric result, SHA-256 of exact extracted text, run status and timestamps. `cvs.analysis.cv_review` (v1) stays intact; latest v2 is stored separately as `cv_review_v2`.
- Contact/summary/education/skills/projects/experience/certifications/achievements use recognized English headings. Exact short lines or `Heading: content` count; ordinary mentions inside sentences do not. Empty/placeholder sections are incomplete. Contact channels can be detected without a heading and displayed without their actual values.
- AI feedback uses the existing OpenRouter structured JSON wrapper. Only relevance and writing are AI-scored; quoted evidence is checked against the exact CV. Other categories and totals are computed on the server.
- The dashboard shows the /10 score, /2 categories and rationale, sections, strengths/weaknesses, prioritized recommendations, evidence and before/after edits when validated. Prior versions can be selected in History. Hash changes produce an outdated warning.

## Scoring rubric (2.0)

| Category | Method |
| --- | --- |
| Clarity | 2 for at least four recognized populated headings; 1 for two or three; otherwise 0. |
| Completeness | 0.5 each for contact, education, skills, and either projects or experience. Optional certificates/awards/summary do not reduce this score. |
| Evidence | 1 for a concrete action verb in sampled projects/experience/achievements; 1 for a recognized measurable scope/outcome (e.g. endpoints/users/tests). Dates/phone numbers do not count. |
| Relevance | AI 0–2 in half-points, explained by a verified CV quote. Fallback: 1 for recognized skills + 1 for projects/experience. No target job is assumed. |
| Writing | AI 0–2 in half-points with verified evidence. Fallback: 2 with no extracted lines over 45 words, 1 with up to three, otherwise 0; this is a concision proxy, not a grammar assessment. |

The total is calculated by summing the five categories, never accepted from an AI-generated total. It stays compatible with the existing 10-point scale; fractional scores are now possible. It is **not an official ATS score, employment assessment or hiring probability**. A high fallback score cannot establish good writing, qualifications or job suitability.

## Reliability, history and privacy

- Existing cookie-based Supabase authentication and private CV Storage remain. No service-role key is introduced.
- History RLS permits users to read only history for their own CVs. Direct authenticated writes are revoked; two narrowly scoped SQL functions check `auth.uid()` and CV ownership explicitly. Their search path is fixed. Neither takes an arbitrary user ID.
- Reservation uses a transaction advisory lock to enforce five new v2 analyses per user per hour across server instances, and one running attempt per user for up to two minutes. Failed/fallback attempts count. Cached results/history do not consume a new analysis slot. There is no automatic paid retry loop.
- A matching hash reuses the saved v2 review. **Analyze again** explicitly creates another history entry. If AI fails or returns invalid JSON, a deterministic result is saved with a visible warning; use Analyze again after resolving provider issues.
- Finalization locks the CV and compares its hash again. Changed content records an outdated snapshot without replacing the current attached review. Expired running reservations are marked failed on the next attempt.
- The model has no tools in this review route. System instructions treat all CV text as untrusted. Zod validates output and bounds fields; unsupported quotations and rewrites are discarded. Rewrites cannot add new numeric claims or substantive vocabulary, switch to an unsupported action, or drop listed qualifiers such as helped/learning/planned. These conservative checks may reject useful rewrites.
- Recognized contact lines and web links are omitted before AI evaluation. This reduces exposure but is **not complete anonymization**: CV context still goes to the configured provider. Raw provider errors are not returned, and CV text/keys are not logged by these changes.
- AI recommendations and scores remain fallible. Exact quotations do not prove that an interpretation is correct, and prompt-injection defenses are layered mitigations rather than a guarantee that a model can never be influenced. Review every suggested edit.

## Limits

Heading aliases are English. Unusual titles, multi-column extraction or line wrapping may cause false misses. Section completeness checks mean sufficient text, not verified completion of every required field. Evidence heuristics sample the first 700 characters per section. The technical vocabulary and metric patterns are finite. No OCR, visual PDF layout analysis, fact checking or certification verification is added. Scanned PDFs need OCR elsewhere. Existing PDF editor format/layout limits still apply.

## Automated verification

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
matching-service/.venv/Scripts/python.exe -m unittest discover -s matching-service -v
node scripts/test-cv-v2-db.mjs
```

The final command needs Docker Desktop and the `postgres:17-alpine` image (Docker may download it). It creates a temporary container with no published ports/network, uses synthetic users/CVs, runs the real migration and assertions, repeats the migration and stops/removes the container. Do not run the fixture SQL in your hosted database. The test fixture reproduces the Supabase auth function/roles and CV ownership policy; it does not test hosted Storage or PostgREST.

Coverage includes heading/mention distinction, empty sections, deterministic and half-point scores, invalid AI responses, hallucinated evidence/numbers/skills, qualifier preservation, contact minimization, content fingerprints, ownership scoping, provider fallback, caching, save failures, stale writes, real PDF upload/extraction, cleanup on failed inserts, preserving new PDF versions, existing tool/company/job tests and Python PDF editing/matching regressions. Real SQL assertions cover save/retrieve, v1 preservation, RLS isolation, anonymous denial, immutability, duplicate prevention, hourly limits and stale content.

## Manual acceptance

1. Apply the migration, upload a synthetic or your own CV, and check all eight section states and five category explanations. The sub-scores must sum to /10.
2. Refresh: the saved result/history should remain. Analyze again: another entry appears without deleting the earlier review. Verify both can be selected.
3. With missing/invalid AI credentials, upload still saves and v2 produces a visibly labelled deterministic review. Restore credentials and explicitly reanalyze for AI feedback.
4. Upload an updated PDF: the new version should have its own fresh review; previous CV/review stays below. Edit a PDF and save: the original stays intact and the new CV can be analyzed independently.
5. In a disposable test CV row, change extracted text without changing its attached review: the old score must show Outdated after refresh. During a running analysis, a changed hash must not be saved as fresh.
6. Use two test accounts: neither may read/review the other's CV/history. Send unauthenticated GET/POST to `/api/cvs/review`: both must return 401.
7. Try six new analyses in one hour: the sixth should return 429. Double-click/concurrent attempts should not start two AI calls. History remains available.
8. Confirm CV download/edit, job matching and company research still use the newest CV. Test loading, errors, history selector and copy buttons in your browser/mobile viewport.

## Evidence selection update (Step 34)

The AI now selects IDs from a bounded catalogue of exact CV passages instead of reproducing quotes from memory. The server restores original text before the existing analyzeCv evidence/rewrite validation. IDs are restricted by the response schema; unknown IDs fail validation. The catalogue excludes redacted contact/link lines, contains at most 200 passages of 600 characters, and may omit later content in unusually fragmented CVs. This reduces quote-copy failures but does not establish that every AI assessment is semantically correct. It still uses one structured generation call and the existing five-per-hour quota.

Old warning messages do not mean the UI hid valid information: unsupported AI categories fall back to rule-based scores and invalid recommendations are discarded. The UI now explains this distinction and explains when no rewrite passes validation. Scores are not job-match or ATS scores. Existing history is unchanged. Select Analyze again (new version) to obtain a new review using the catalogue; simply refreshing may reuse old saved analysis. Review extracted text first if PDF extraction is inaccurate. No SQL or API key change is required.
