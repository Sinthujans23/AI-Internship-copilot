import { z } from "zod";
import { jobSchema } from "@/lib/job-schema";
import { matchSchema } from "@/lib/matching-schema";

export const bulletsSchema = z.object({ bullets: z.array(z.string()) }).strict();
export const emailSchema = z.object({ subject: z.string(), body: z.string() }).strict();
export const preparationSchema = z.object({
  job: jobSchema, match: matchSchema,
  rewritten_bullets: z.array(z.string()).length(3), email: emailSchema,
  summary: z.string(), cv_id: z.string().uuid(), cv_name: z.string(),
  prepared_at: z.string().datetime(), tools_used: z.array(z.string()),
}).strict();
export type Preparation = z.infer<typeof preparationSchema>;
