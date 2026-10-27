import type { Database } from "@/types/database";
import { getOpenAI } from "@/lib/services/openai";
import { analyzeJobPost } from "@/lib/ai/analyze-job";
import { structuredOutput } from "@/lib/ai/structured";
import { jobSchema, type JobDetails } from "@/lib/job-schema";
import { bulletsSchema, emailSchema, preparationSchema } from "@/lib/agent-schema";
import type { SkillMatch } from "@/lib/matching-schema";
import { matchCvToJob } from "@/lib/matching";
import { AppError } from "@/lib/api";
import { runToolLoop, AgentLoopError } from "./tool-loop";

type AppRow = Database["public"]["Tables"]["applications"]["Row"];
type CvRow = Database["public"]["Tables"]["cvs"]["Row"];

export async function prepareApplication(application: AppRow, cv: CvRow) {
  const client = getOpenAI();
  let job: JobDetails | undefined;
  let match: SkillMatch | undefined;
  let bullets: string[] | undefined;
  let email: { subject: string; body: string } | undefined;
  const started = Date.now();
  try {
    const final = await runToolLoop(async (messages, tools) => {
      if (Date.now() - started > 240000) throw new AppError("Preparation timed out. Please retry.", 504);
      const response = await client.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini", messages,
        ...(tools.length ? { tools, tool_choice: "auto" as const, parallel_tool_calls: false } : {}),
        max_tokens: 1000,
      });
      if (response.choices[0]?.finish_reason === "length") throw new AppError("The agent response was incomplete. Please retry.", 502);
      const message = response.choices[0]?.message;
      if (!message) throw new AppError("The agent returned an empty response.", 502);
      return message;
    }, async name => {
      if (name === "analyze_job") {
        const existing = jobSchema.safeParse(application.job_analysis);
        job = existing.success ? existing.data : await analyzeJobPost(application.job_text);
        return job;
      }
      if (name === "get_cv") return { text: cv.extracted_text, skills: cv.skills, file_name: cv.file_name };
      if (!job) throw new AppError("The agent has not analyzed the job.", 502);
      if (name === "match_score") { match = await matchCvToJob(cv, job); return match; }
      if (name === "rewrite_bullets") {
        const result = await structuredOutput(bulletsSchema, "tailored_bullets", "Rewrite exactly three CV bullets for this job using only CV facts. Never invent employers, credentials, skills, experience or metrics. If evidence is insufficient, include an explicit [add your actual ...] placeholder. Return three nonempty bullets.", { job, cv_text: cv.extracted_text, match });
        if (result.bullets.length !== 3 || result.bullets.some(bullet => !bullet.trim())) throw new AppError("The AI did not return three usable bullets. Retry.", 502);
        bullets = result.bullets; return result;
      }
      email = await structuredOutput(emailSchema, "application_email", "Draft a short professional application email, about 100-150 words, based only on these CV facts and job details. Use [Your Name] and [Hiring Manager] when unknown. Do not claim missing skills or fabricate qualifications. Do not send anything.", { job, cv_text: cv.extracted_text });
      if (!email.subject.trim() || !email.body.trim()) throw new AppError("The AI returned an empty email draft.", 502);
      return email;
    });
    // Persist real tool outputs, rather than any score invented in the final prose.
    return preparationSchema.parse({ job, match, rewritten_bullets: bullets, email, summary: final.summary,
      cv_id: cv.id, cv_name: cv.file_name, prepared_at: new Date().toISOString(), tools_used: final.trace });
  } catch (error) {
    if (error instanceof AgentLoopError) throw new AppError(error.message, 502);
    throw error;
  }
}
