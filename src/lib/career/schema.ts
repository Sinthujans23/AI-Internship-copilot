import { z } from "zod";

const text = z.string().trim().min(1).max(4000);
export const questionsSchema = z.object({ questions: z.array(z.object({
  question: text, focus: z.enum(["Technical", "Project", "Behavioural"]),
})).length(5) });
const rubric = z.number().int().min(0).max(5);
export const interviewFeedbackSchema = z.object({ feedback: z.array(z.object({
  relevance: rubric, specificity: rubric, clarity: rubric,
  strengths: text, improvement: text, suggested_outline: text,
})).length(5) });
export const draftSchema = z.object({ cover_letter: text, application_email: text, follow_up: text });
export type DraftContent = z.infer<typeof draftSchema>;
export type InterviewSession = {
  id: string; user_id: string; cv_id: string | null; application_id: string | null;
  context: { cv_name: string; company: string; role: string; cv_text: string; job_text: string };
  questions: z.infer<typeof questionsSchema>["questions"];
  answers: string[] | null; feedback: z.infer<typeof interviewFeedbackSchema>["feedback"] | null;
  score: number | null; created_at: string; completed_at: string | null;
};
export type DraftPack = {
  id: string; user_id: string; cv_id: string | null; application_id: string | null;
  context: { cv_name: string; company: string; role: string; job_text: string };
  content: DraftContent; created_at: string; updated_at: string;
};
export const feedbackSchema = z.object({
  job_url: z.string().url().max(2000).refine(v => new URL(v).protocol === "https:" && !new URL(v).username && !new URL(v).password),
  title: z.string().trim().min(1).max(300), company: z.string().trim().min(1).max(300),
  verdict: z.enum(["relevant", "not_relevant", "expired"]),
});
export type JobFeedback = z.infer<typeof feedbackSchema> & { user_id: string; updated_at: string };
export function interviewScore(feedback: z.infer<typeof interviewFeedbackSchema>["feedback"]) {
  return Math.round(feedback.reduce((sum, f) => sum + f.relevance + f.specificity + f.clarity, 0) / 75 * 100);
}
