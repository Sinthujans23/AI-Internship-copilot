import { z } from "zod";
import type { CvAnalysis, JobAnalysis, MatchResult } from "@/types";
import { getOpenAI } from "@/lib/services/openai";

const jobSchema = z.object({ title: z.string(), company: z.string().nullable(), requiredSkills: z.array(z.string()), preferredSkills: z.array(z.string()), responsibilities: z.array(z.string()), qualifications: z.array(z.string()) });
const cvSchema = z.object({ skills: z.array(z.string()), education: z.array(z.string()), projects: z.array(z.string()), experience: z.array(z.string()), qualifications: z.array(z.string()) });
const wording = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
const overlap = (a: string, b: string) => { const x = new Set(wording(a).split(" ").filter(w => w.length > 2)); const y = wording(b).split(" ").filter(w => w.length > 2); return x.size ? y.filter(w => x.has(w)).length / Math.max(1, y.length) : 0; };
function parseJson<T>(content: string | null, schema: z.ZodType<T>): T { let value: unknown; try { value = JSON.parse(content || "{}"); } catch { throw new Error("The AI returned invalid JSON. Please try again."); } return schema.parse(value); }
export async function analyzeJob(description: string): Promise<JobAnalysis> {
 const r = await getOpenAI().chat.completions.create({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages: [{ role: "system", content: "Extract job details. Return only valid JSON with title, company (string or null), requiredSkills, preferredSkills, responsibilities, qualifications (arrays of concise strings). Never infer details absent from the input." }, { role: "user", content: description }], response_format: { type: "json_object" } });
 return parseJson(r.choices[0]?.message.content, jobSchema);
}
export async function analyzeCv(text: string): Promise<CvAnalysis> {
 const r = await getOpenAI().chat.completions.create({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages: [{ role: "system", content: "Extract only facts explicitly present in this CV. Return JSON with skills, education, projects, experience, qualifications; each an array of concise strings. Do not invent or embellish." }, { role: "user", content: text }], response_format: { type: "json_object" } });
 return parseJson(r.choices[0]?.message.content, cvSchema);
}
export function scoreMatch(job: JobAnalysis, cv: CvAnalysis, fullText: string): MatchResult {
 const evidencePool = [...cv.skills, ...cv.experience, ...cv.projects, ...cv.education, ...cv.qualifications, fullText].join("\n");
 const all = [...new Set([...job.requiredSkills, ...job.preferredSkills])]; const matched: string[] = []; const partial: string[] = []; const missing: string[] = [];
 for (const skill of all) { const exact = [...cv.skills, ...cv.experience, ...cv.projects, ...cv.qualifications].some(s => wording(s).includes(wording(skill)) || wording(skill).includes(wording(s))); const ratio = Math.max(...[...cv.experience, ...cv.projects, ...cv.qualifications].map(v => overlap(skill, v)), 0); if (exact || ratio >= 0.6 ) matched.push(skill); else if (ratio >= 0.3) partial.push(skill); else missing.push(skill); }
 const req = job.requiredSkills.length ? job.requiredSkills : all; const requiredCovered = req.filter(s => matched.includes(s)).length + req.filter(s => partial.includes(s)).length * .5; const requiredScore = req.length ? requiredCovered / req.length : .5; const pref = job.preferredSkills.length ? job.preferredSkills.filter(s => matched.includes(s)).length / job.preferredSkills.length : requiredScore;
 const score = Math.round(Math.max(0, Math.min(100, requiredScore * 80 + pref * 20)));
 const evidence = matched.map(skill => [...cv.experience, ...cv.projects, ...cv.qualifications, ...cv.skills].find(line => wording(line).includes(wording(skill)) || overlap(skill, line) >= .5)).filter((v): v is string => Boolean(v)).slice(0, 5);
 return { score, matched, partial, missing, evidence, explanation: "Score weights required-skill coverage at 80% and preferred-skill coverage at 20%. Partial matches count as half. Skill mentions and related CV evidence are checked across skills, experience, projects, and qualifications; this is an estimate, not a hiring outcome." };
}
export async function createDrafts(job: JobAnalysis, cv: CvAnalysis): Promise<{ bulletSuggestions: Array<{ original: string; suggested: string }>; email: { subject: string; body: string } }> {
 const r = await getOpenAI().chat.completions.create({ model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages: [{ role: "system", content: "Create factual, ATS-friendly application materials based only on supplied CV facts. Never add metrics, skills, names, or experience. Return JSON: bulletSuggestions array of {original,suggested} and email {subject,body}. If CV has no evidence, return empty bulletSuggestions. Email must use [Your Name] and [Hiring Manager] placeholders where needed." }, { role: "user", content: JSON.stringify({ job, cv }) }], response_format: { type: "json_object" } });
 const schema = z.object({ bulletSuggestions: z.array(z.object({ original: z.string(), suggested: z.string() })), email: z.object({ subject: z.string(), body: z.string() }) }); return parseJson(r.choices[0]?.message.content, schema);
}

