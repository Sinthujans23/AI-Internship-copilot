# Company shortlist and CV coaching

## Preferences and employer links

Run the new company migration (or rerun all of `supabase/setup.sql`). Open `/companies`, save your target role, preferred locations, salary range/currency/period, work mode and other requirements. Upload your CV first. Add up to five official company/job URLs, one per line. Reports appear one at a time and are saved privately.

The app reads the supplied page and up to two same-origin careers/jobs/engineering pages linked from it. It does not search job boards or claim a complete view of a company. JavaScript-only, protected, blocked or oversized sites may not be readable; use a direct public job-post URL. Public HTTPS only; DNS results and every redirect are checked, private/reserved addresses are blocked, and approved DNS addresses are pinned during the request.

## What the report means

- Technology, role, location, work mode, salary and certification facts need exact source quotes. Unsupported extractions are discarded. A website's frontend framework is not evidence of the employer's internal stack.
- Missing facts stay unknown. Currency and pay periods are not silently converted. A salary-range overlap is not a salary offer. Headquarters is not assumed to be a job location.
- A company homepage comparison uses general published technology signals. It does not establish a vacancy or a role-specific requirement.
- CV matching uses the existing embedding service, then converts the percentage to `/10` by dividing by ten. The rating is a similarity estimate, not accuracy or hiring probability. No verified skills or no matching service means an unknown rating, not a fabricated number.
- Suggested CV changes cite original CV evidence; new numeric achievements are rejected. Interview practice cites actual project evidence. Review suggested wording and fill unknown details truthfully.
- Project-upgrade suggestions cite existing CV project evidence and propose practical future features/implementation steps. Build them before adding them as experience.
- Learning plans suggest skills, practice tasks and generic course topics. They are not employer-approved courses. Only explicitly quoted certification/credential mentions appear as employer evidence, and that evidence applies to the source page, not every role in the company.
- Similar-company names are unverified AI research leads. Add their official URLs to evaluate them before treating them as a shortlist. No new web-search API or search account is required.
- Email is a draft only. Verify the employer's official application channel and recipient yourself; the app neither guesses an address nor sends email.

## Tests and manual checks

`npm.cmd test` includes SSRF URL/IP guards, website parsing, exact-evidence rejection, salary-unit handling, rating conversion, and CV/project grounding. These are offline tests, not proof of live model accuracy. Existing OpenAI and matching service configuration is still needed.

After applying SQL, test preferences saving/refresh, a readable employer URL, a direct job URL, a site with no salary/certifications, a service outage, report persistence/deletion, and another account's isolation. Check every quoted employer fact against its linked page. A blocked/JavaScript site must show a readable error. Original source pages can change after a report; timestamps and CV identity identify the snapshot.

Each report can open its source CV in the [PDF region editor](PDF_EDITOR.md) with suggestions available to apply to a selected block. Original PDF layout regions are retained, with explicit font/fit limitations and approval before saving a new version.

## Expanded application preparation

New reports include source-quoted non-stack requirements, responsibilities and application instructions, scoped to the selected job page. Preferred/required wording is preserved. If the input is only a general company website, the report labels its signals as general and asks for a vacancy link; it does not infer internal hiring requirements from the website framework.

Coaching now adds suggested CV sections with evidence the student must have, a tailored application checklist, an introduction outline, technical/behavioral practice questions with answer prompts, and questions the student can ask the interviewer. Existing learning tasks, grounded project answers, project upgrades, CV rewrites and copyable email remain. Practice questions are recommendations, not confirmed company questions. No recipient is guessed and no email is sent.

No new migration is needed: these fields are saved in `company_reports.result`. Existing reports remain readable, with a rerun notice for expanded coaching. Analyze the same company/direct-vacancy link again with the latest CV and target role. Verify sources, review the proposed CV additions and email, refresh to confirm persistence. AI generation still needs a valid provider key and credits; numerical skill matching also needs the running matching service.
