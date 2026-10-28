import { z } from "zod";

export const usernameSchema = z.string().trim().min(1).max(39).regex(/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/, "Enter a GitHub username, not a URL.").transform(s=>s.toLowerCase());
export const repoNameSchema = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/).refine(s=>s!=="." && s!=="..");
export const repositorySchema = z.object({
  id:z.number().int(), name:repoNameSchema, full_name:z.string(), private:z.boolean(), fork:z.boolean(), archived:z.boolean(),
  description:z.string().nullable(), updated_at:z.string(), default_branch:z.string(),
  owner:z.object({login:z.string()}), language:z.string().nullable().optional(),
});
export type Repository = z.infer<typeof repositorySchema>;
export const evidenceSchema=z.object({skill:z.string().max(100),source:z.string().max(200),quote:z.string().max(600),kind:z.enum(["language","dependency","readme"])});
export const improvements = {
  contribution:"Document your own contribution and distinguish it from collaborators, tutorials or forked code.",
  setup:"Add reproducible installation and usage instructions.",
  tests:"Document tests and what behavior they verify; add tests where missing.",
  architecture:"Explain the architecture and why each technology was chosen.",
  demo:"Add a working demo or screenshots with clear limitations.",
  outcomes:"Measure outcomes only when you can reproduce and substantiate the measurements.",
} as const;
export const projectAISchema=z.object({purpose_quote:z.string().max(600),functionality_quotes:z.array(z.string().min(8).max(600)).max(5),improvements:z.array(z.enum(["contribution","setup","tests","architecture","demo","outcomes"])).max(6)}).strict();
export const projectAnalysisSchema=z.object({
  version:z.literal(1),repository:repositorySchema, analyzed_at:z.string(),fetched_at:z.string(),
  evidence:z.array(evidenceSchema).max(150),purpose:z.string(),functionality:z.array(z.string()),
  improvements:z.array(z.string()),warnings:z.array(z.string()),mode:z.enum(["AI-assisted","deterministic"]),cv_suggestion:z.string(),
});
export type ProjectAnalysis=z.infer<typeof projectAnalysisSchema>;
export type Evidence=z.infer<typeof evidenceSchema>;
