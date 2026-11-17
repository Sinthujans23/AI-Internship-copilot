import { canonicalJobUrl } from "@/lib/applications";
import type { HybridJob } from "@/lib/hybrid-jobs";
import type { JobFeedback } from "./schema";
export function personalizeJobs(jobs: HybridJob[], feedback: Pick<JobFeedback, "job_url" | "verdict">[]) {
  const votes = new Map(feedback.map(f => [canonicalJobUrl(f.job_url), f.verdict]));
  return jobs.filter(j => votes.get(canonicalJobUrl(j.url)) !== "expired").map(job => {
    const verdict = votes.get(canonicalJobUrl(job.url));
    const adjustment = verdict === "relevant" ? 5 : verdict === "not_relevant" ? -10 : 0;
    return { ...job, score: Math.max(0, Math.min(100, job.score + adjustment)),
      explanations: [...job.explanations, ...(adjustment ? [`Your feedback on this listing adjusts relevance by ${adjustment > 0 ? "+" : ""}${adjustment} points. Base evidence remains unchanged.`] : [])] };
  }).sort((a, b) => ({ match: 0, unknown: 1, mismatch: 2 }[a.preference_fit || "unknown"] - { match: 0, unknown: 1, mismatch: 2 }[b.preference_fit || "unknown"]) || b.score - a.score || a.id.localeCompare(b.id));
}
