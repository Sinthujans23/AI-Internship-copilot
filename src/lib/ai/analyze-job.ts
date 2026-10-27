import { jobInputSchema, jobSchema } from "@/lib/job-schema";
import { structuredOutput } from "./structured";

export async function analyzeJobPost(jobText: string) {
  const { job_text } = jobInputSchema.parse({ job_text: jobText });
  return structuredOutput(jobSchema, "job_details", "Extract the role, company (null when absent), required skills, good-to-have skills, and responsibilities. Use concise skill names. If no role is stated, use 'Role not specified'.", { job_text });
}
