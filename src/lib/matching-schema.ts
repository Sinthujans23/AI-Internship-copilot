import { z } from "zod";
export const matchSchema = z.object({
  score: z.number().int().min(0).max(100),
  matched_skills: z.array(z.string()), missing_skills: z.array(z.string()),
}).strict();
export type SkillMatch = z.infer<typeof matchSchema>;
