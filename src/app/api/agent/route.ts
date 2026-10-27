import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { applicationContext } from "@/lib/application-context";
import { prepareApplication } from "@/lib/agent/prepare";

export const maxDuration = 300;
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { application_id } = z.object({ application_id: z.string().uuid() }).parse(await request.json());
    const { application, cv } = await applicationContext(supabase, user.id, application_id);
    const result = await prepareApplication(application, cv);
    const saved = await supabase.from("applications").update({ job_analysis: result.job, match_score: result.match.score, match_result: result.match, agent_result: result }).eq("id", application.id).eq("user_id", user.id).select("id").maybeSingle();
    if (saved.error) throw new AppError("Preparation completed but could not be saved. Run the Step 5 SQL.");
    if (!saved.data) throw new AppError("Application was deleted before preparation finished.", 404);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
