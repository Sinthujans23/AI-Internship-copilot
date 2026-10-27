import { z } from "zod";
import { matchSchema } from "@/lib/matching-schema";

export const preferencesSchema = z.object({
  target_role: z.string().trim().min(2).max(150),
  locations: z.array(z.string().trim().min(1).max(100)).max(10),
  work_mode: z.enum(["Any", "Remote", "Hybrid", "On-site"]),
  salary_min: z.number().nonnegative().nullable(), salary_max: z.number().nonnegative().nullable(),
  currency: z.enum(["LKR", "USD", "INR", "EUR", "GBP", "AUD", "CAD"]),
  salary_period: z.enum(["monthly", "yearly", "hourly"]),
  notes: z.string().trim().max(2000),
}).refine(value => value.salary_min === null || value.salary_max === null || value.salary_min <= value.salary_max, { message: "Minimum salary must not exceed maximum salary." });
export type CareerPreferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: CareerPreferences = { target_role: "Software Engineering Intern", locations: [], work_mode: "Any", salary_min: null, salary_max: null, currency: "LKR", salary_period: "monthly", notes: "" };

// Every employer claim needs an exact quote and a source index.
const evidence = { source_index: z.number().int(), quote: z.string() };
export const sourcedFact = z.object({ value: z.string(), ...evidence }).strict();
export const factsSchema = z.object({
  scope: z.enum(["job_post", "company_general", "unknown"]),
  role: sourcedFact.nullable(), locations: z.array(sourcedFact),
  work_mode: z.object({ value: z.enum(["Remote", "Hybrid", "On-site"]), ...evidence }).strict().nullable(),
  salary: z.object({ minimum: z.number().nullable(), maximum: z.number().nullable(), currency: z.string(), period: z.enum(["monthly", "yearly", "hourly"]), ...evidence }).strict().nullable(),
  technologies: z.array(sourcedFact), certifications: z.array(sourcedFact),
}).strict();
export type CompanyFacts = z.infer<typeof factsSchema>;
export type ResearchSource = { url: string; title: string; text: string; retrieved_at: string };
export const coachingSchema = z.object({
  fit_summary: z.string(),
  cv_changes: z.array(z.object({ original_quote: z.string(), suggested_text: z.string(), reason: z.string() }).strict()),
  project_upgrades: z.array(z.object({ project_quote: z.string(), suggested_feature: z.string(), why_for_company: z.string(), implementation_steps: z.array(z.string()) }).strict()),
  email: z.object({ subject: z.string(), body: z.string() }).strict(),
  learning_plan: z.array(z.object({ skill: z.string(), priority: z.enum(["High", "Medium", "Low"]), reason: z.string(), practice_task: z.string(), course_topic: z.string() }).strict()),
  interview_answers: z.array(z.object({ question: z.string(), project_quote: z.string(), suggested_answer: z.string(), follow_up: z.string() }).strict()),
  similar_company_leads: z.array(z.object({ name: z.string(), reason_to_research: z.string(), what_to_verify: z.string() }).strict()),
}).strict();
export type Coaching = z.infer<typeof coachingSchema>;
export type PreferenceCheck = { name: string; status: "match" | "mismatch" | "unknown"; detail: string };
export type CompanyReport = {
  id: string; source_url: string; company_label: string; cv_id: string; cv_name: string; created_at: string;
  preferences: CareerPreferences; sources: Omit<ResearchSource, "text">[]; facts: CompanyFacts;
  preference_checks: PreferenceCheck[]; match: z.infer<typeof matchSchema> | null; rating_out_of_ten: number | null;
  coaching: Coaching; warnings: string[];
};
