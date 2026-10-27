import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { applicationContext } from "@/lib/application-context";
import { analyzeJobPost } from "@/lib/ai/analyze-job";
import { jobSchema } from "@/lib/job-schema";
import { matchCvToJob } from "@/lib/matching";

export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { application_id } = z.object({ application_id: z.string().uuid() }).parse(await request.json());
    const { application, cv } = await applicationContext(supabase, user.id, application_id);
    const job = application.job_analysis ? jobSchema.parse(application.job_analysis) : await analyzeJobPost(application.job_text);
    const match = await matchCvToJob(cv, job);
    const saved = await supabase.from("applications").update({ job_analysis: job, match_score: match.score, match_result: match }).eq("id", application.id).eq("user_id", user.id);
    if (saved.error) throw new AppError("Match computed but could not be saved. Run the Step 4 SQL.");
    return NextResponse.json(match);
  } catch (error) { return apiError(error); }
}
