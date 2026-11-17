# Known limitations

- AI can be factually wrong despite schemas, exact-evidence checks and prompt boundaries. Review all drafts. Scores are not ATS certification or hiring probabilities.
- CV tailoring deliberately supports conservative source-wording edits, not unrestricted generation or automatic section reflow. PDF scans, rotated/signed pages, unsupported fonts and text that does not fit can fail safely.
- Public job coverage is limited; no restricted platform scraping. Jobs, salary, location and interview facts may be missing or outdated.
- Mock-interview rubric scores are AI practice guidance, not calibrated skill certification. Unsubmitted answers remain in page state. Task completion and approved skills are self-reported. See CAREER_WORKFLOWS.md for snapshot retention and feature bounds.
- Quotas/deduplication reduce costs but do not guarantee exactly-once billing across process crashes. Some features have quotas without shared result caching. Provider spending caps are still required.
- Application lists and some other views are bounded rather than fully paginated. Native Kanban dragging has a keyboard/touch stage-select alternative.
- File deletion and database deletion are not atomic. Derived snapshots and RAG data have separate retention. Full account erasure and automatic inactive-user cache cleanup need an operational workflow.
- Security headers include frame/base/object restrictions, not a strict nonce-based script CSP. Auth rate limiting/SMTP/backups/monitoring must be configured in hosted services.
- Browser CI covers anonymous flows; authenticated tests require dedicated credentials and are explicitly skipped when absent. Local SQL fixtures do not prove hosted Auth/Storage configuration.
- Patched dependencies are pinned/locked and tested here; repeat audits before each release. Provider model compatibility and live source availability remain live acceptance checks.
