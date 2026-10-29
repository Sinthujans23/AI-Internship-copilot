import {paidOperation} from "@/lib/security/paid-operation";
import {readJson} from "@/lib/security/request";
import { NextResponse } from "next/server";
import { requireUser, apiError } from "@/lib/api";
import { analyzeJobPost } from "@/lib/ai/analyze-job";
import { jobInputSchema } from "@/lib/job-schema";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const {supabase}=await requireUser();
    const input = jobInputSchema.parse(await readJson(request));
    return NextResponse.json(await paidOperation(supabase,"analyze_job",input,()=>analyzeJobPost(input.job_text)), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
