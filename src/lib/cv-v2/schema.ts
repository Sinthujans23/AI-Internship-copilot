import { z } from "zod";

export const sectionNames = ["contact", "summary", "education", "skills", "projects", "experience", "certifications", "achievements"] as const;
export const sectionSchema = z.object({ name: z.enum(sectionNames), status: z.enum(["detected", "incomplete", "missing"]), heading: z.string().nullable(), evidence: z.string(), reason: z.string(), line: z.number().int().nonnegative().nullable() });
const score = z.number().min(0).max(2).multipleOf(0.5);
const assessment = z.object({ score, explanation: z.string().min(1).max(600), evidence: z.string().min(4).max(700) }).strict();
const feedback = z.object({ priority: z.enum(["High", "Medium", "Low"]), area: z.string().min(1).max(100), issue: z.string().min(1).max(500), recommendation: z.string().min(1).max(700), evidence: z.string().min(4).max(700), before: z.string().max(700), after: z.string().max(900) }).strict();
// AI evaluates only two language-dependent categories. All claims need CV evidence.
export const aiFeedbackSchema = z.object({ relevance: assessment, writing: assessment, feedback: z.array(feedback).max(8) }).strict();
export type AiFeedback = z.infer<typeof aiFeedbackSchema>;
const category = z.object({ score, explanation: z.string(), basis: z.enum(["rules", "AI + evidence validation"]), evidence: z.string() });
export const reviewV2Schema = z.object({
  version: z.literal(2), rubric_version: z.literal("2.0"), input_hash: z.string().regex(/^[a-f0-9]{64}$/), reviewed_at: z.string().datetime(),
  mode: z.enum(["hybrid", "deterministic"]), score: z.number().min(0).max(10),
  criteria: z.object({ clarity: category, relevance: category, evidence: category, completeness: category, writing: category }),
  sections: z.array(sectionSchema).length(8), strengths: z.array(z.string()), weaknesses: z.array(z.string()),
  improvements: z.array(feedback.extend({ evidence: z.string().max(700), source: z.enum(["rules", "AI"]) })), limitations: z.array(z.string()), warnings: z.array(z.string()),
});
export type ReviewV2 = z.infer<typeof reviewV2Schema>;
export type Section = z.infer<typeof sectionSchema>;
export function savedV2(analysis: unknown): ReviewV2 | null {
  const value = analysis && typeof analysis === "object" && "cv_review_v2" in analysis ? analysis.cv_review_v2 : null;
  const parsed = reviewV2Schema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
