import { structuredOutput } from "@/lib/ai/structured";
import { matchCvToJob } from "@/lib/matching";
import { factsSchema, coachingSchema, type CareerPreferences, type CompanyReport } from "./schema";
import { verifyFacts, verifyCoaching, checkPreferences, ratingFromScore } from "./evidence";
import { fetchCompanySources } from "./website";

export async function researchCompany(url: string, preferences: CareerPreferences, cv: { id: string; file_name: string; skills: string[]; extracted_text: string }) {
  const sources = await fetchCompanySources(url);
  const rawFacts = await structuredOutput(factsSchema, "employer_evidence", `Extract ONLY explicitly published evidence from these source pages. source_index is zero-based. Every fact needs an exact source quote (ideally 20-250 characters). Never infer a company's internal stack from its website framework, products, scripts, or branding. Technologies must be named in visible source text. Job locations must describe work locations, never assume headquarters is a vacancy location. Salary needs an explicit ISO currency code and period in the quote; ambiguous '$' means null. Do not invent an open position. Classify scope as job_post only for a concrete role listing. Certifications must be explicitly mentioned as certifications/credentials; a technology or partner logo is not an accepted course. Return null/empty arrays for missing facts.`, { target_role: preferences.target_role, sources: sources.map((source, index) => ({ source_index: index, url: source.url, text: source.text })) }, 4500);
  const facts = verifyFacts(rawFacts, sources);
  const warnings: string[] = [];
  if (JSON.stringify(rawFacts) !== JSON.stringify(facts)) warnings.push("Unsupported extracted facts were discarded because source quotes or values could not be verified.");
  if (facts.scope !== "job_post") warnings.push("These are general website signals, not verified requirements for an open role. Add a direct job-post link for a role-specific comparison.");
  if (!facts.certifications.length) warnings.push("No employer certification acceptance/requirement was verified. Learning suggestions below are not employer-approved courses.");
  let match: CompanyReport["match"] = null;
  if (facts.technologies.length) {
    try {
      match = await matchCvToJob(cv, { role: facts.role?.value || preferences.target_role, company: sources[0].title, skills_required: facts.technologies.map(fact => fact.value), good_to_have: [], responsibilities: [] });
    } catch { warnings.push("Embedding matching is unavailable. The rating is unknown; start the matching service and check its API key before rerunning."); }
  } else warnings.push("No verified technology/skill requirements were found, so no match percentage or rating is fabricated.");
  const generated = await structuredOutput(coachingSchema, "company_career_coaching", `Create practical application coaching for the target role using ONLY the provided CV facts and verified company evidence. Distinguish general recommendations from employer facts. fit_summary must not invent a score, salary, hiring status, or certification acceptance. Suggest up to five factual CV changes: original_quote must be copied from the CV, preserve actual projects, duties, technologies, and metrics; never add qualifications or achievements. Draft a concise professional email (100-150 words), with [Your Name]/[Hiring Manager] when unknown; never guess a recipient email. Give up to eight learning items focused on missing skills and role, with a practical project task and a generic course TOPIC, never claim the employer accepts or endorses that course. Create up to four interview questions and suggested STAR-style answers grounded in exact project_quote text from the CV; unknown ownership/results must remain [add your actual ...] placeholders. Suggest at most four similar-company NAMES as unverified research leads based on the role/domain; do not claim they have openings, meet salary/location requirements, or accept certificates. Explain what must be checked.`, { preferences, verified_company_facts: facts, cv_text: cv.extracted_text, cv_skills: cv.skills, match }, 6500);
  const coaching = verifyCoaching(generated, cv.extracted_text);
  if (coaching.cv_changes.length !== generated.cv_changes.length || coaching.interview_answers.length !== generated.interview_answers.length) warnings.push("Some CV/interview suggestions were discarded because their original evidence was missing or new numeric claims appeared.");
  return {
    id: crypto.randomUUID(), source_url: sources[0].url, company_label: sources[0].title,
    cv_id: cv.id, cv_name: cv.file_name, created_at: new Date().toISOString(), preferences,
    sources: sources.map(({ url, title, retrieved_at }) => ({ url, title, retrieved_at })),
    facts, preference_checks: checkPreferences(preferences, facts), match,
    rating_out_of_ten: ratingFromScore(match?.score ?? null), coaching, warnings,
  } satisfies CompanyReport;
}
