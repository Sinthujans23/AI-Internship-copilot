import { NextResponse } from "next/server";
import { requireUser, apiError } from "@/lib/api";
import { analyzeJobPost } from "@/lib/ai/analyze-job";
import { jobInputSchema } from "@/lib/job-schema";

export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    await requireUser();
    const input = jobInputSchema.parse(await request.json());
    return NextResponse.json(await analyzeJobPost(input.job_text), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
