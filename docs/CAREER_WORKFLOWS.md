# Interviews, reminders, drafts, comparison and progress

For an existing installation, apply `supabase/migrations/20261112000000_career_workflows.sql` in Supabase SQL Editor after the existing supported migrations. New installations can use the regenerated `supabase/setup.sql`. This migration adds tables and `applications.deadline_date` without deleting existing records. No new environment variables are needed. AI features use the existing provider settings and production paid-operation quota (shared `agent` bucket, ten operations per hour across supported paid workflows).

## Features

| Location | Workflow |
| --- | --- |
| `/interviews` | Choose a CV and saved application with a job description. Generate five practice questions, answer all five, and submit for feedback. Relevance, specificity and clarity each receive 0–5; the server calculates a 0–100 practice score. Reopen saved sessions and paginate history. New practice uses a new request ID; retries of the same generation reuse the paid-operation cache. |
| `/applications` | Set an application deadline, interview date or follow-up date. Reminders show when opening the tracker or dashboard, with up to three overdue and five upcoming items. Export all active dates as an `.ics` calendar. Deadline reminders apply to Saved jobs; terminal Offer/Rejected/Withdrawn stages have no active reminders. Clear or update completed dates in the tracker. |
| `/drafts` | Generate a cover letter, application email and follow-up together. Edit, save, copy or download each text. History retains its source CV name and job snapshot. Concurrent edits produce a conflict instead of overwriting a newer edit. Cached generation reloads current saved edits. |
| `/compare` | Pick two versions, view line additions/removals, and inspect extracted text side by side. Tailored versions select their parent when available. Shows tailoring targets and current tracker links. Links do not prove which file was externally submitted. |
| `/jobs` | Mark a listing Relevant (+5 points) or Not relevant (−10 points), or report it expired to hide it from your account. Preference groups remain dominant. Feedback uses canonical listing URLs; undo feedback, including expired reports, from the feedback panel. Applies to the same listing in future searches, not a trained recommendation model. |
| `/dashboard` | Eight rolling seven-day application periods; recorded interview conversion for that dated cohort; completed tasks across all saved roadmap versions; recurring required gaps from current-CV match snapshots; latest ten scored interview sessions; reminders/calendar export. |

Application detail panels link directly to interview practice and draft creation for that application. Navigation links expose all new pages.

## Boundaries

- Questions and advice are AI practice material, not confirmed employer questions. Rubric scores are not calibrated proficiency or hiring probabilities. Different roles/questions limit comparisons.
- Questions and final submitted answers are stored. Unsubmitted answers and unsaved draft edits remain in page state and are lost on navigation/reload.
- Interview sessions keep a bounded CV/job text snapshot for consistent assessment. Deleting a CV/application clears its foreign key, but does not erase saved session snapshots or draft contents. Complete privacy erasure still requires the account retention workflow.
- Drafts are never emailed/submitted automatically. Replace placeholders and verify every claim before use.
- Calendar exports contain all-day dates, not verified interview times; configure alerts in the receiving calendar. Exported calendars are snapshots and do not sync with later edits.
- Reminders use the browser's local calendar day; weekly analytics use Asia/Colombo days. Deadline edits are included in the existing audit trail.
- Text comparison normalizes blank lines and surrounding whitespace. The diff uses the first 400 non-empty lines per document; full extracted text remains available. It does not compare PDF geometry/fonts.
- Feedback considers the latest 1,000 records; base match snapshots remain unchanged so repeated searches cannot compound score adjustments. Expired reports are personal signals, not verified listing closures.
- Progress queries page through up to 10,000 records per dataset. Query failures/caps produce unavailable metrics rather than invented zeros. Conversion excludes undated/deleted applications and unrecorded earlier transitions. Learning totals may count repeated tasks across roadmap versions.

## Validation and manual acceptance

`npm run test` covers dates, calendar escaping/UTF-8 folding, comparison, feedback ordering/undo, cohort conversion, pagination, owner scoping, provider preflight, score calculation, concurrent completion, and cached draft edits. `node scripts/test-cv-v2-db.mjs --career` uses an isolated PostgreSQL Docker container to exercise SQL/RLS, linked ownership, deadline auditing, foreign-key cleanup and migration reapplication. Docker must be running.

In a staging project after migration:

1. Upload two CV versions and save an application with job text and dates; verify reminders and import `.ics` into a calendar.
2. Complete one mock interview; reload history and dashboard and verify answer feedback and score agree. Reopen an unfinished session and start a distinct new session.
3. Generate a draft pack, edit and save, reload, and request the same pack again within 15 minutes; current edits should remain. Use two tabs to check edit conflicts.
4. Compare source/tailored versions and inspect application links. Confirm adding/removing text produces the expected diff.
5. Mark job feedback, search again and inspect the explanation/ordering. Report expired, then restore it from the feedback panel. Base scores must not compound.
6. Move an applied job through Interview to Rejected; conversion should retain its recorded interview transition. Complete a learning task and reload progress.
7. Use a second account to verify all new histories and feedback are private. Live provider and authenticated browser checks require configured staging credentials and are separate from mocked tests.
