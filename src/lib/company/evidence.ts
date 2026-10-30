import {displayCoaching} from "./display-coaching";
import type { CareerPreferences, Coaching, CompanyFacts, PreferenceCheck, ResearchSource } from "./schema";

export const normalizeQuote = (value: string) => value.toLowerCase().replace(/\s+/g, " ").trim();
export function quoteExists(quote: string, text: string) {
  return quote.trim().length >= 4 && normalizeQuote(text).includes(normalizeQuote(quote));
}
function namesValue(quote: string, value: string) {
  const escaped = normalizeQuote(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}+#])${escaped}(?=$|[^\\p{L}\\p{N}+#])`, "u").test(normalizeQuote(quote));
}
export function verifyFacts(input: CompanyFacts, sources: ResearchSource[]): CompanyFacts {
  const supports = (fact: { source_index: number; quote: string }) => Number.isInteger(fact.source_index) && !!sources[fact.source_index] && quoteExists(fact.quote, sources[fact.source_index].text);
  const named = (fact: { value: string; source_index: number; quote: string }) => supports(fact) && !!fact.value.trim() && namesValue(fact.quote, fact.value);
  const role = input.role && named(input.role) ? input.role : null;
  const inScope = (fact: { source_index: number }) => input.scope !== "job_post" || !role || fact.source_index === role.source_index;
  const work = input.work_mode;
  const workSupported = work && supports(work) && inScope(work) && (work.value === "On-site" ? /on.?site|in.?office|office.based/i.test(work.quote) : normalizeQuote(work.quote).includes(work.value.toLowerCase()));
  let salary = input.salary;
  if (salary) {
    const periods = { monthly: /month/i, yearly: /year|annual|annum/i, hourly: /hour/i };
    const numbers = salary.quote.replaceAll(",", "").match(/\d+(?:\.\d+)?\s*[kKmM]?/g)?.map(token => parseFloat(token) * (/k/i.test(token) ? 1000 : /m/i.test(token) ? 1000000 : 1)) || [];
    const limits = [salary.minimum, salary.maximum].filter((value): value is number => value !== null);
    if (!supports(salary) || !inScope(salary) || !/^[A-Z]{3}$/.test(salary.currency) || !new RegExp(`(^|[^A-Z])${salary.currency}($|[^A-Z])`).test(salary.quote.toUpperCase()) || !periods[salary.period].test(salary.quote) || !limits.length || limits.some(value => !Number.isFinite(value) || value < 0 || !numbers.includes(value)) || (salary.minimum !== null && salary.maximum !== null && salary.minimum > salary.maximum)) salary = null;
  }
  return {
    scope: input.scope === "job_post" && !role ? "unknown" : input.scope, role,
    locations: input.locations.filter(fact => named(fact) && inScope(fact)).slice(0, 10), work_mode: workSupported ? work : null,
    salary, technologies: input.technologies.filter(fact => named(fact) && inScope(fact)).slice(0, 25),
    requirements: (input.requirements || []).filter(fact => named(fact) && inScope(fact)).slice(0, 10),
    responsibilities: (input.responsibilities || []).filter(fact => named(fact) && inScope(fact)).slice(0, 8),
    application_instructions: (input.application_instructions || []).filter(fact => named(fact) && inScope(fact)).slice(0, 5),
    certifications: input.certifications.filter(fact => named(fact) && inScope(fact) && /certif|credential|accredit/i.test(fact.quote)).slice(0, 10),
  };
}
export function verifyCoaching(coaching: Coaching, cvText: string): Coaching {
  coaching = displayCoaching(coaching);
  const numbers = (value: string): string[] => value.match(/\b\d+(?:\.\d+)?%?/g) || [];
  return { ...coaching,
    cv_additions: (coaching.cv_additions || []).slice(0, 6),
    application_checklist: (coaching.application_checklist || []).slice(0, 6),
    interview_preparation: {
      introduction_outline: (coaching.interview_preparation?.introduction_outline || []).slice(0, 5),
      practice_questions: (coaching.interview_preparation?.practice_questions || []).slice(0, 6).map(item => ({ ...item, answer_outline: item.answer_outline.slice(0, 4) })),
      questions_to_ask: (coaching.interview_preparation?.questions_to_ask || []).slice(0, 6),
    },
    cv_changes: coaching.cv_changes.filter(change => quoteExists(change.original_quote, cvText) && numbers(change.suggested_text).every(number => numbers(change.original_quote).includes(number))).slice(0, 5),
    project_upgrades: (coaching.project_upgrades || []).filter(upgrade => quoteExists(upgrade.project_quote, cvText)).slice(0, 3).map(upgrade => ({ ...upgrade, implementation_steps: upgrade.implementation_steps.slice(0, 5) })),
    interview_answers: coaching.interview_answers.filter(answer => quoteExists(answer.project_quote, cvText)).slice(0, 5),
    learning_plan: coaching.learning_plan.slice(0, 8), similar_company_leads: coaching.similar_company_leads.slice(0, 4),
  };
}
export function checkPreferences(preferences: CareerPreferences, facts: CompanyFacts): PreferenceCheck[] {
  const checks: PreferenceCheck[] = [];
  const target = normalizeQuote(preferences.target_role);
  checks.push({ name: "Role", status: !facts.role ? "unknown" : normalizeQuote(facts.role.value).includes(target) || target.includes(normalizeQuote(facts.role.value)) ? "match" : "unknown", detail: facts.role ? `Published title: ${facts.role.value}. Check the role details for equivalence.` : "No role-specific title was verified." });
  if (preferences.locations.length) {
    const match = facts.locations.some(location => preferences.locations.some(wanted => normalizeQuote(location.value).includes(normalizeQuote(wanted)) || normalizeQuote(wanted).includes(normalizeQuote(location.value))));
    checks.push({ name: "Location", status: !facts.locations.length ? "unknown" : match ? "match" : "mismatch", detail: facts.locations.length ? `Published locations: ${facts.locations.map(value => value.value).join(", ")}` : "Job location not published in the retrieved evidence." });
  }
  if (preferences.work_mode !== "Any") checks.push({ name: "Work mode", status: !facts.work_mode ? "unknown" : facts.work_mode.value === preferences.work_mode ? "match" : "mismatch", detail: facts.work_mode ? `Published mode: ${facts.work_mode.value}` : "Work mode not verified." });
  if (preferences.salary_min !== null || preferences.salary_max !== null) {
    const salary = facts.salary;
    let status: PreferenceCheck["status"] = "unknown";
    let detail = "Salary not verified. No salary amount or currency is inferred.";
    if (salary) {
      detail = `Published: ${salary.minimum ?? "?"}–${salary.maximum ?? "?"} ${salary.currency}/${salary.period}.`;
      if (salary.currency !== preferences.currency || salary.period !== preferences.salary_period) detail += " Currency/period differs; no conversion is assumed.";
      else if ((preferences.salary_min !== null && salary.maximum !== null && salary.maximum < preferences.salary_min) || (preferences.salary_max !== null && salary.minimum !== null && salary.minimum > preferences.salary_max)) status = "mismatch";
      else if (salary.minimum !== null && salary.maximum !== null) { status = "match"; detail += " Range overlaps your preference; this is not an offer."; }
    }
    checks.push({ name: "Salary", status, detail });
  }
  return checks;
}
export function ratingFromScore(score: number | null) { return score === null ? null : Math.round(score) / 10; }
