import { AppError } from "@/lib/api";
import { matchSchema } from "@/lib/matching-schema";
import type { JobDetails } from "@/lib/job-schema";

export async function matchCvToJob(cv: { skills: string[]; extracted_text: string }, job: JobDetails) {
  const url = process.env.MATCHING_SERVICE_URL;
  const key = process.env.MATCHING_SERVICE_API_KEY;
  if (!url || !key) throw new AppError("Matching service is not configured. Set MATCHING_SERVICE_URL and MATCHING_SERVICE_API_KEY.", 503);
  const skills = [...new Set(job.skills_required.length ? job.skills_required : job.good_to_have)];
  if (!skills.length) throw new AppError("No job skills were found. Analyze a more detailed job post.", 422);
  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/match`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": key },
      body: JSON.stringify({ cv_text: cv.extracted_text, cv_skills: cv.skills, job_skills: skills }),
      signal: AbortSignal.timeout(50000), cache: "no-store", redirect: "error",
    });
  } catch { throw new AppError("Matching service could not be reached. Start FastAPI or check its URL.", 503); }
  if (!response.ok) throw new AppError(response.status === 429 ? "Embedding quota or rate limit reached. Try later." : "Matching failed. Check the matching service keys and logs.", response.status === 429 ? 429 : 502);
  try {
    const match = matchSchema.parse(await response.json());
    const returned = [...match.matched_skills, ...match.missing_skills];
    if (returned.length !== skills.length || new Set(returned).size !== skills.length || returned.some(skill => !skills.includes(skill))) throw new Error("Skill partition mismatch");
    return match;
  } catch { throw new AppError("Matching service returned invalid data.", 502); }
}
