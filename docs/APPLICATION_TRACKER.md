# Job Application Tracker

The restored `/applications` page reuses `public.applications` and `/api/applications`. It does not submit applications or send emails.

## Setup

In Supabase SQL Editor run `supabase/migrations/20261029000000_application_tracker.sql` after the existing migrations. New installations can run `supabase/setup.sql`. Restart with `npm run dev`, sign in, and open Applications.

Existing rows and stages are preserved. Earlier transitions cannot be reconstructed: existing applications receive a clearly labelled baseline event. Legacy creates still default to Applied; new UI saves explicitly use Saved.

## Features and integration

- Seven stages: Saved, Applied, Assessment, Interview, Offer, Rejected, Withdrawn.
- Drag cards between columns or select a stage using keyboard/touch.
- Edit company, role, URL, notes, application/interview/follow-up dates, job text, CV version and company report.
- Save public discovery listings or verified job-specific company reports directly into Saved.
- Link a CV version explicitly; existing agent/matching routes use the linked version when available, otherwise the latest CV for compatibility.
- Linked company reports expose existing research, project interview questions and practice answers. Their original CV snapshot remains labelled; changing the tracker CV does not regenerate a report.
- Search company/title/notes, filter by stage, and view counts across all loaded applications.
- Database triggers record creation, stage changes and detail edits atomically. History cannot be forged by authenticated clients. Owner-only RLS protects records and history; foreign CV/report links are rejected even through direct database calls.

## API compatibility

GET `/api/applications` still returns an array. GET `?history=<uuid>` returns owned events. POST accepts the original fields plus optional tracker fields. PATCH accepts `{id,status}` as before and optional editable fields. DELETE `?id=<uuid>` removes the application and its history. Owner identity always comes from authenticated server state.

HTTP(S) URLs are normalized by removing fragments and known tracking parameters, sorting query parameters, and preserving job identifiers. A per-user database unique index prevents duplicate stored URLs, including concurrent saves (409). Jobs without URLs can be saved more than once. Different URLs for the same vacancy may still need manual deduplication. Direct database clients should use the same canonicalization.

## Test

1. `npm run test`, `npm run lint`, `npm run build`.
2. With Docker Desktop: `node scripts/test-cv-v2-db.mjs --tracker` uses only synthetic local records, tests RLS/CRUD/history/linked ownership/deduplication and migration reruns.
3. Sign in, save a Find jobs listing, then save it again: one application and a duplicate message.
4. Open Applications. Move Saved to Assessment by drag, then Interview using the Stage menu. Refresh: the state persists.
5. Edit notes/dates/company/title, choose a CV version and company report, and save. History shows changes; linked report contains interview practice.
6. Search by company or notes and filter stages. Clear filters to restore all cards. Verify keyboard/touch operation and narrow-screen layout.
7. Delete a test application, confirm, and refresh. Other applications remain. Sign into another account: the first user's applications/history are inaccessible.

## Limits

Dates are calendar days, not scheduled notifications or interview times. Detail events record that an edit happened, not copies of old private notes. Deletion intentionally removes history; there is no undo. Updates use last-write-wins across browser tabs. The current simple board uses the Supabase default row limit (normally 1,000); report choices show the latest 100 reports. No automatic job submission, email, calendar integration or reminders. Hosted SQL and signed-in browser checks must be performed in your Supabase project.
