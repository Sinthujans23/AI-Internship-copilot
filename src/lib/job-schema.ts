import { z } from "zod";

// The model, API, and page share one data contract.
export const jobSchema = z.object({
  role: z.string(), company: z.string().nullable(),
  skills_required: z.array(z.string()), good_to_have: z.array(z.string()),
  responsibilities: z.array(z.string()),
}).strict();
export const jobInputSchema = z.object({ job_text: z.string().trim().min(40, "Paste at least 40 characters from the job post.").max(20000) });
export type JobDetails = z.infer<typeof jobSchema>;
