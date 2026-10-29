# Job-specific CV tailoring

Open **Tailor CV** (`/tailoring`). Save a job from Find jobs or Company Research into Applications first. Select an uploaded CV version and saved job, generate suggestions, then accept or reject each item. Reviewed decisions persist across refreshes.

## Installation

Run `supabase/migrations/20261029010000_cv_tailoring.sql` in Supabase SQL Editor after the tracker migration. New installations can use the combined `supabase/setup.sql`. Start Next.js with `npm run dev` and the existing PyMuPDF service with `npm run dev:matching`. Existing OpenRouter configuration is reused; no new keys are needed.

## How it works

- Server verifies both CV and application ownership before sending content to the existing AI provider. Five generation requests per user/hour are reserved atomically in Postgres, including failed attempts.
- The saved job description supplies requirements. When it is empty, quotes from an owned, linked, vacancy-specific company report can supply evidence. General company technologies never become vacancy requirements. Add a complete job description to Applications when evidence is insufficient.
- Existing deterministic skill extraction distinguishes explicitly required and preferred skills. Synonyms reuse the hybrid matching helpers. Unknown/unsupported skills can be missed: this is not exhaustive qualification verification.
- AI selects relevant full CV lines and recommends a section order. Exact quote checks discard unsupported evidence. Before/after proposals are separately labelled as suggestions.
- Conservative wording changes remove only a first-person introductory prefix from a complete existing line (for example, `I developed a Python API` becomes `developed a Python API`). All remaining wording, qualifiers and metrics remain unchanged. This intentionally does not offer unrestricted generative rewriting or newly invented action verbs. A polished CV may produce no safe edits.
- Missing skills remain learning gaps. Matched existing keywords can be emphasized without adding unsupported experience. Section order is advice; automatic PDF layout reflow is not attempted.
- Acceptance records approval of a proposal, not verified experience or proof that it was applied to the final file.

## Existing PDF editor integration

Choose **Apply accepted suggestions in PDF editor**, select the matching original text block, use the suggestion, queue the edit, and preview the PDF. For tailoring sessions, the source quote must occur exactly in the selected text before replacement; surrounding text is preserved. Whitespace differences or unsupported layouts require manual review/editing instead.

Download the preview or approve **Save as new current CV**. The existing upload pipeline reparses the PDF, creates a unique private storage path, inserts a new CV row, and leaves the original file and row unchanged. The version stores parent CV, target application, tailoring session and accepted-proposal snapshot. Saved versions appear on Tailor CV after returning/refreshing, with preview/edit and authenticated download links. New current versions affect features that use the latest CV; existing report snapshots remain unchanged.

Edits that do not fit their original area are rejected by PyMuPDF. Scans, rotated text, signed PDFs, unsupported fonts/layouts and non-Latin replacement text may need the original document editor. Preview carefully; replacement fonts may differ. No automatic applications or emails are sent.

## Data and privacy

`cv_tailoring` stores immutable generated results, source snapshots, user decisions and timestamps. RLS restricts reads/inserts to owners, and an authenticated RPC updates one decision at a time. Linked CV/job ownership is checked both by the server and database triggers. Existing private bucket/download authorization is reused. Old AI reviews are not copied to new CV versions.

Deleting a source CV or job cascades its tailoring sessions. Surviving revised CVs retain accepted-proposal snapshots while deleted lineage references become null. History lists the latest 50 sessions; CV/job lists use the existing database row limit. Explicit file uploads remain user-authored documents; approved proposals are not a certification of factual accuracy.

## Verification

- `npm run test`: extraction, invalid AI data, injected/partial quotes, individual acceptance, required/preferred gaps, ownership and upload/version regression coverage.
- `node scripts/test-cv-v2-db.mjs --tailoring`: isolated synthetic Postgres ownership, acceptance persistence, immutable analysis, version lineage, original preservation and repeat-migration checks.
- In `matching-service`: `.\.venv\Scripts\python.exe -m unittest test_pdf_editing` verifies actual PDF editing/export and unsupported-layout behavior.
- `npm run lint` and `npm run build`.

Manual signed-in test: upload a text PDF containing an authentic first-person project sentence; save a related job; generate; accept one suggestion and reject another; refresh; open the PDF editor; apply only the approved wording; preview, download and save. Refresh Tailor CV to verify the new linked version. Download both versions and confirm the original is unchanged. A second account must not load either the session or private CV URL. Try an unsupported/scanned PDF and an unavailable AI provider: an error should leave the original intact. Hosted SQL and live provider/browser workflow need your own project credentials.
