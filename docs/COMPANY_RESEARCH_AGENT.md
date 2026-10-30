Current architecture: Step 32 supersedes the tool-calling orchestration below with the [Smart Router](SMART_ROUTER.md). Mandatory searches run locally with zero LLM calls; fact extraction and combined coaching remain separate validated stages.

# Company Research Agent

The existing Company Shortlist POST route now uses a bounded tool-calling agent to choose the order of three evidence searches: `find_requirements`, `find_application_details`, and `find_company_technologies`. Website extraction and indexing still happen before the loop. All topics must be covered, so this first version adapts retrieval order, not the scope of a web crawl. It does not browse arbitrary sites or invent queries/requirements.

Tools accept empty JSON only. User, session, document IDs and vectors are bound on the authenticated server; model output cannot choose another user's data or a fetch destination. Existing RLS, robots/SSRF restrictions, citation provenance checks, validated fact extraction, CV comparison and coaching remain in use. Website snippets are untrusted tool output. Prompt instructions alone are not a complete injection defense; capability restrictions and deterministic provenance validation remain essential.

At most three model turns run with 350 output tokens each, no retries, and a 30-second agent window. Each tool runs once. Invalid calls or provider errors fall back to the original deterministic searches for unfinished topics. Database/provenance failures still stop research. Report generation is separate; agent prose is never treated as verified employer facts. Existing five-researches/hour reservation applies. This adds up to three model calls per company, using the configured OpenRouter/OpenAI model.

No new SQL or API keys are needed. The trace is saved in the existing report JSON as `rag.agent`; historical reports remain readable. The evidence panel shows agent/fallback mode and topics checked. The agent cannot edit CVs, send mail or submit applications.

Run `npm.cmd run dev` and `npm.cmd run dev:matching` in separate terminals with the existing migrations/configuration. In Company Shortlist, submit an allowed public company/job URL with an uploaded CV. Check sources, facts and the Research workflow label. A non-tool-capable model should use fallback and show a warning. Existing report save errors remain a separate database setup issue.

Tests: `node --import tsx --test tests/company-agent.test.ts`. Covers adaptive ordering, tool-result round trips, invalid/cross-user parameters, unknown tools, failed providers, no repeated retrievals, early finals and provenance failure propagation. Full tests/lint/build also cover existing features. Live authenticated/provider acceptance requires the user's configured services.

This step implements Company Research only. The existing Application Preparation agent is unchanged; Interview Coach and Adaptive Learning agents remain future work.
