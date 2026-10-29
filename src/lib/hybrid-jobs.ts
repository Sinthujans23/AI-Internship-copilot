import { extractCvSkills } from "./cv-skills";
import type { PublicJob } from "./job-search";
import type { CareerPreferences } from "./company/schema";

export const MATCH_VERSION = "hybrid-2";
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
export type HybridJob = PublicJob & JobMetadata & { preference_checks?:PreferenceCheck[]; preference_fit?:"match"|"unknown"|"mismatch"; score: number; matched_skills: string[]; missing_required: string[]; missing_preferred: string[]; mentioned_skills: string[]; required_skills: string[]; preferred_skills: string[]; components: { name: string; value: number | null; weight: number }[]; explanations: string[]; semantic: number | null; version: string };
const lower = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
export function eligibleJobs(jobs: (PublicJob & JobMetadata)[], now = Date.now()) {
  const urls = new Set<string>(), fingerprints = new Set<string>();
  return jobs.filter(job => {
    if (job.closed || (job.expires_at && Date.parse(job.expires_at) <= now)) return false;
    const url = new URL(job.url); url.hash = "";
    for(const key of [...url.searchParams.keys()])if(/^(utm_|tracking$|fbclid$|gclid$)/i.test(key))url.searchParams.delete(key);
    url.searchParams.sort();
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
    const checks=checkPreferences(job,preferences);
    for(const check of checks){explanations.push(check.reason);if(check.status!=="unknown")pref.push(Number(check.status==="match"));}
    const preference_fit=checks.some(c=>c.status==="mismatch")?"mismatch" as const:checks.some(c=>c.status==="unknown")?"unknown" as const:"match" as const;
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
    return { ...job, preference_checks:checks,preference_fit, work_mode: job.work_mode || (job.remote ? "Remote" : "Unknown"), score, matched_skills: matched, missing_required: extracted.required.filter(s => !has(s)), missing_preferred: extracted.preferred.filter(s => !has(s)), mentioned_skills: extracted.mentioned, required_skills: extracted.required, preferred_skills: extracted.preferred, components, explanations, semantic: semanticScore, version: MATCH_VERSION };
  }).sort((a,b) => ({match:0,unknown:1,mismatch:2}[a.preference_fit]-{match:0,unknown:1,mismatch:2}[b.preference_fit]) || b.score-a.score || a.id.localeCompare(b.id));
}

export type PreferenceCheck={name:string;status:"match"|"mismatch"|"unknown";reason:string};
const roleText=(s:string)=>lower(s).replace(/front end/g,"frontend").replace(/back end/g,"backend").replace(/full stack/g,"fullstack").replace(/quality assurance/g,"qa");
export function checkPreferences(job:PublicJob & JobMetadata,p:CareerPreferences):PreferenceCheck[]{
 const checks:PreferenceCheck[]=[];
 const terms=roleText(p.target_role).split(" ").filter(w=>!["intern","internship","trainee","junior","engineering","engineer","developer","development","student"].includes(w));
 const title=roleText(job.title);
 const roleMatch=terms.some(t=>(" "+title+" ").includes(" "+t+" ")) || (terms.includes("software")&&/frontend|backend|fullstack|web developer|application developer/.test(title));
 checks.push({name:"Target role (title keywords)",status:!terms.length?"unknown":roleMatch?"match":"mismatch",reason:!terms.length?"Target role is too broad to verify from title keywords.":roleMatch?"Title matches target-role keywords or a related software role family.":"Title does not match the selected target role; skills alone do not make it a suitable role."});
 if(p.locations.length){const location=lower(job.location);const global=/^(anywhere|worldwide|global|remote worldwide)$/.test(location);const regional=/^(remote|europe|asia|emea|apac|international)$/.test(location);
 const countryNames=["sri lanka","india","germany","united kingdom","united states","canada","australia"];
 const country=(text:string)=>countryNames.find(c=>(" "+text+" ").includes(" "+c+" ")) || (/\b(colombo|kandy|jaffna|galle)\b/.test(text)?"sri lanka":/\b(chennai|bengaluru|bangalore|mumbai|delhi|hyderabad)\b/.test(text)?"india":undefined);
 const sourceCountry=country(location);
 const fit=p.locations.some(l=>(" "+location+" ").includes(" "+lower(l)+" ") || (countryNames.includes(lower(l)) && sourceCountry===lower(l)));
 const broadCountry=!fit&&countryNames.includes(location)&&p.locations.some(l=>country(lower(l))===location&&lower(l)!==location);
 checks.push({name:"Location",status:!location||regional||broadCountry?"unknown":fit||global?"match":"mismatch",reason:!location||regional||broadCountry?"Location unknown or too broad to confirm eligibility; remote does not mean worldwide.":fit?"Matches one of your preferred locations.":global?"Source states worldwide location; verify work authorization/time-zone eligibility.":"No preferred location is stated in the listing; check the employer's eligibility rules."});}
 const mode=job.work_mode||(job.remote?"Remote":"Unknown");
 if(p.work_mode!=="Any")checks.push({name:"Work mode",status:mode==="Unknown"?"unknown":mode===p.work_mode?"match":"mismatch",reason:mode==="Unknown"?"Work mode unknown; no remote/on-site assumption made.":"Listed work mode: "+mode+"; requested: "+p.work_mode+"."});
 if(p.salary_min!==null||p.salary_max!==null){const comparable=job.salary&&job.salary.currency===p.currency&&job.salary.period===p.salary_period;const fit=comparable&&job.salary!.max>=(p.salary_min??0)&&job.salary!.min<=(p.salary_max??Infinity);checks.push({name:"Salary",status:!comparable?"unknown":fit?"match":"mismatch",reason:!comparable?"Salary unknown or not comparable in your currency/period; no currency conversion assumed.":fit?"Published salary overlaps your range.":"Published salary is outside your range."});}
 if(p.notes.trim())checks.push({name:"Other requirements",status:"unknown",reason:"Your additional requirements: "+p.notes.slice(0,500)+" — free-text conditions need employer verification; they are not marked as satisfied from keyword mentions."});
 return checks;
}

export function isInternshipTitle(title:string){return /\b(intern(?:ship)?s?|trainee|working student|werkstudent\w*|praktik\w*)\b/i.test(title);}
