import {paidOperation} from "@/lib/security/paid-operation";
import {readJson} from "@/lib/security/request";
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
    const { application_id } = z.object({ application_id: z.string().uuid() }).parse(await readJson(request));
    const { application, cv } = await applicationContext(supabase, user.id, application_id);
    const {job,match} = await paidOperation(supabase,"match",{application_id:application.id,job:application.job_text,cv_id:cv.id,cv_text:cv.extracted_text,skills:cv.skills},async()=>{
    const job = application.job_analysis ? jobSchema.parse(application.job_analysis) : await analyzeJobPost(application.job_text);
    const match = await matchCvToJob(cv, job);
    return {job,match};
    });
    const saved = await supabase.from("applications").update({ job_analysis: job, match_score: match.score, match_result: match }).eq("id", application.id).eq("user_id", user.id).eq("job_text",application.job_text).filter("cv_id",application.cv_id?"eq":"is",application.cv_id||null).select("id").maybeSingle();
    if (saved.error) throw new AppError("Match computed but could not be saved. Run the Step 4 SQL.");
    if (!saved.data) throw new AppError("Application changed or was deleted before matching finished.", 404);
    return NextResponse.json(match,{headers:{"Cache-Control":"private, no-store"}});
  } catch (error) { return apiError(error); }
}
