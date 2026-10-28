import { z } from "zod";
import type { HybridJob } from "./hybrid-jobs";

export async function semanticJobs(cvText: string, jobs: HybridJob[]) {
  if (!jobs.length) return {};
  if (!process.env.MATCHING_SERVICE_URL || !process.env.MATCHING_SERVICE_API_KEY) throw new Error("Semantic service is not configured.");
  const response = await fetch(`${process.env.MATCHING_SERVICE_URL.replace(/\/$/, "")}/rank`, {
    method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": process.env.MATCHING_SERVICE_API_KEY },
    body: JSON.stringify({ cv_text: cvText.slice(0,50000), jobs: jobs.map(j=>({id:j.id,text:`${j.title}\n${j.description}`.slice(0,6000)})) }),
    signal: AbortSignal.timeout(45000), cache:"no-store", redirect:"error",
  });
  if(!response.ok) throw new Error("Semantic service unavailable.");
  const {scores}=z.object({scores:z.record(z.number().finite().min(0).max(1))}).parse(await response.json());
  if(Object.keys(scores).length!==jobs.length || jobs.some(j=>scores[j.id]===undefined)) throw new Error("Incomplete semantic results.");
  return scores;
}
