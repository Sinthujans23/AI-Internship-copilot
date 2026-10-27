import { z } from "zod";

// Five equally weighted text-quality criteria; the server calculates the total.
const criterion = z.object({ score: z.number().int().min(0).max(2), feedback: z.string().min(1).max(600) });
export const cvReviewOutputSchema = z.object({
  summary: z.string().min(1).max(800),
  criteria: z.object({ clarity: criterion, relevance: criterion, evidence: criterion, completeness: criterion, writing: criterion }),
  strengths: z.array(z.string().min(1).max(400)).max(5),
  improvements: z.array(z.object({ priority: z.enum(["High", "Medium", "Low"]), area: z.string().min(1).max(100), recommendation: z.string().min(1).max(700) })).min(1).max(6),
});
export const cvReviewSchema = cvReviewOutputSchema.extend({ score: z.number().int().min(0).max(10), reviewed_at: z.string().datetime(), version: z.literal(1) });
export type CvReview = z.infer<typeof cvReviewSchema>;
export function finishCvReview(input: unknown): CvReview {
  const review = cvReviewOutputSchema.parse(input);
  return { ...review, score: Object.values(review.criteria).reduce((sum, item) => sum + item.score, 0), reviewed_at: new Date().toISOString(), version: 1 };
}
export function savedCvReview(analysis: unknown): CvReview | null {
  if (!analysis || typeof analysis !== "object" || !("cv_review" in analysis)) return null;
  const parsed = cvReviewSchema.safeParse(analysis.cv_review);
  return parsed.success ? parsed.data : null;
}
