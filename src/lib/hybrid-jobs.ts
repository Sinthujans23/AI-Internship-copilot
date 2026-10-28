import { extractCvSkills } from "./cv-skills";
import type { PublicJob } from "./job-search";
import type { CareerPreferences } from "./company/schema";

export const MATCH_VERSION = "hybrid-1";
export type JobMetadata = { work_mode?: "Remote" | "Hybrid" | "On-site" | "Unknown"; salary?: { min: number; max: number; currency: string; period: string } | null; application_url?: string | null; fetched_at?: string; expires_at?: string | null; closed?: boolean };
const aliases: Record<string, string> = { "react.js": "React", reactjs: "React", "node.js": "Node.js", nodejs: "Node.js", "next.js": "Next.js", nextjs: "Next.js", js: "JavaScript", ts: "TypeScript", postgresql: "PostgreSQL", postgres: "PostgreSQL", "rest api": "REST" };
export function normalizeSkill(value: string) { return aliases[value.trim().toLowerCase()] || value.trim(); }
export function skillsIn(text: string) {
  let normalized = text;
  for (const [alias, name] of Object.entries(aliases)) normalized = normalized.replace(new RegExp(`(?<![a-z0-9.])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z0-9])`, "gi"), name);
  return [...new Set(extractCvSkills(normalized).map(normalizeSkill))];
}
// Only explicit requirement headings/phrases classify skills as mandatory.
export function jobSkills(text: string) {
  const required = new Set<string>(), preferred = new Set<string>();
  let section = "mentioned";
  for (const line of text.split(/\n/)) {
    if (/^\s*(requirements|required skills|qualifications|must have)\s*:?\s*$/i.test(line)) section = "required";
    else if (/^\s*(preferred|preferred skills|nice to have|bonus)\s*:?\s*$/i.test(line)) section = "preferred";
    else if (/^\s*(responsibilities|benefits|about us|what we offer)\s*:?\s*$/i.test(line)) section = "mentioned";
    const kind = /not required|no .+ required|not essential/i.test(line) ? "mentioned" : /preferred|nice.to.have|bonus|optional/i.test(line) ? "preferred" : /must|required|essential/i.test(line) ? "required" : section;
    for (const skill of skillsIn(line)) { if (kind === "required") required.add(skill); if (kind === "preferred") preferred.add(skill); }
  }
  for (const skill of required) preferred.delete(skill);
  return { required: [...required], preferred: [...preferred], mentioned: skillsIn(text).filter(s => !required.has(s) && !preferred.has(s)) };
}
export type HybridJob = PublicJob & JobMetadata & { score: number; matched_skills: string[]; missing_required: string[]; missing_preferred: string[]; mentioned_skills: string[]; required_skills: string[]; preferred_skills: string[]; components: { name: string; value: number | null; weight: number }[]; explanations: string[]; semantic: number | null; version: string };
const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function eligibleJobs(jobs: (PublicJob & JobMetadata)[], now = Date.now()) {
  const urls = new Set<string>(), fingerprints = new Set<string>();
  return jobs.filter(job => {
    if (job.closed || (job.expires_at && Date.parse(job.expires_at) <= now)) return false;
    const url = new URL(job.url); url.search = ""; url.hash = "";
    const key = [job.company, job.title, job.location].map(lower).join("|");
    if (urls.has(url.href) || fingerprints.has(key)) return false;
    urls.add(url.href); fingerprints.add(key); return true;
  });
}
export function rankHybrid(jobs: (PublicJob & JobMetadata)[], cvSkills: string[], preferences: CareerPreferences, semantic: Record<string, number> = {}): HybridJob[] {
  const known = new Set(cvSkills.map(s => normalizeSkill(s).toLowerCase()));
  const has = (s: string) => known.has(s.toLowerCase());
  return eligibleJobs(jobs).map(job => {
    const extracted = jobSkills(job.description);
    const matched = [...extracted.required, ...extracted.preferred, ...extracted.mentioned].filter(has);
    const coverage = (skills: string[]) => skills.length ? skills.filter(has).length / skills.length : null;
    const explanations: string[] = [];
    const pref: number[] = [];
    const roleWords = lower(preferences.target_role).split(" ").filter(w => !["intern", "internship", "trainee", "engineering", "engineer"].includes(w));
    const roleFit = roleWords.length ? roleWords.filter(w => lower(job.title).includes(w)).length / roleWords.length : null;
    if (roleFit !== null) { pref.push(roleFit); explanations.push(`Target role term coverage: ${Math.round(roleFit * 100)}%.`); }
    if (preferences.locations.length) {
      if (!job.location.trim()) explanations.push("Location unknown; location preference was not scored.");
      else { const fit = preferences.locations.some(l => ` ${lower(job.location)} `.includes(` ${lower(l)} `)); pref.push(Number(fit)); explanations.push(fit ? "Matches one of your preferred locations." : "No preferred location is stated. Remote does not imply worldwide eligibility."); }
    }
    const mode = job.work_mode || (job.remote ? "Remote" : "Unknown");
    if (preferences.work_mode !== "Any") {
      if (mode === "Unknown") explanations.push("Work mode unknown; preference was not scored.");
      else { pref.push(Number(mode === preferences.work_mode)); explanations.push(`Listed work mode: ${mode}; requested: ${preferences.work_mode}.`); }
    }
    if (preferences.salary_min !== null || preferences.salary_max !== null) {
      if (!job.salary || job.salary.currency !== preferences.currency || job.salary.period !== preferences.salary_period) explanations.push("Salary unknown or not comparable in your currency/period; salary was not scored.");
      else { const fit = job.salary.max >= (preferences.salary_min ?? 0) && job.salary.min <= (preferences.salary_max ?? Infinity); pref.push(Number(fit)); explanations.push(fit ? "Published salary overlaps your range." : "Published salary is outside your range."); }
    }
    const semanticScore = typeof semantic[job.id] === "number" && Number.isFinite(semantic[job.id]) ? Math.max(0, Math.min(1, semantic[job.id])) : null;
    const components = [
      { name: "Required skills", value: coverage(extracted.required), weight: 35 },
      { name: "Preferred skills", value: coverage(extracted.preferred), weight: 10 },
      { name: "Other mentioned skills", value: coverage(extracted.mentioned), weight: 10 },
      { name: "Semantic relevance", value: semanticScore, weight: 30 },
      { name: "Preferences", value: pref.length ? pref.reduce((a,b) => a+b, 0) / pref.length : null, weight: 15 },
    ];
    const available = components.filter(c => c.value !== null);
    const score = available.length ? Math.round(100 * available.reduce((s,c) => s + c.value! * c.weight, 0) / available.reduce((s,c) => s+c.weight,0)) : 0;
    if (semanticScore === null) explanations.push("Semantic service unavailable or not evaluated; weights redistribute across available evidence.");
    if (!extracted.required.length) explanations.push("No explicit required skills recognized; ordinary mentions are not mandatory requirements.");
    explanations.push("Skill gaps mean not recognized in the CV, not proof you lack the skill. Scores indicate recommendation relevance, not hiring probability.");
    return { ...job, work_mode: mode, score, matched_skills: matched, missing_required: extracted.required.filter(s => !has(s)), missing_preferred: extracted.preferred.filter(s => !has(s)), mentioned_skills: extracted.mentioned, required_skills: extracted.required, preferred_skills: extracted.preferred, components, explanations, semantic: semanticScore, version: MATCH_VERSION };
  }).sort((a,b) => b.score-a.score || a.id.localeCompare(b.id));
}
