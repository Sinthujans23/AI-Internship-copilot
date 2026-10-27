import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { structuredOutput } from "@/lib/ai/structured";
import { cvReviewOutputSchema, finishCvReview, savedCvReview } from "@/lib/cv-review-schema";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { cv_id } = z.object({ cv_id: z.string().uuid() }).parse(await request.json());
    const { data: cv, error } = await supabase.from("cvs").select("*").eq("id", cv_id).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!cv) throw new AppError("CV not found. Upload a CV first.", 404);
    // Reuse a saved review on retries/refreshes to avoid another paid request.
    if (savedCvReview(cv.analysis)) return NextResponse.json({ cv }, { headers: { "Cache-Control": "private, no-store" } });
    const result = await structuredOutput(cvReviewOutputSchema, "cv_quality_review", `Review this student's CV text for internship applications. This is general CV quality, not a company match or hiring probability. Score each criterion 0 (missing/weak), 1 (partial), or 2 (strong): clarity (clear sections and understandable content), relevance (skills/projects relevant to the student's stated field), evidence (specific responsibilities, projects and outcomes), completeness (contact channel, education, skills, projects/experience), writing (concise, consistent language). Assess students fairly: projects/coursework can replace employment; do not penalize lack of paid work or demand fabricated metrics. Evaluate only supplied text; do not infer visual PDF layout or ATS performance. Do not reproduce personal contact details or evaluate protected characteristics. Give concrete, prioritized recommendations explaining what to change and why. Never invent experience, credentials, skills or achievements. If information is absent, say not found in extracted text. Always include at least one actionable next improvement.`, { cv_text: cv.extracted_text });
    const review = finishCvReview(result);
    const analysis = cv.analysis && typeof cv.analysis === "object" && !Array.isArray(cv.analysis) ? cv.analysis : {};
    const updated = await supabase.from("cvs").update({ analysis: { ...analysis, cv_review: review } }).eq("id", cv.id).eq("user_id", user.id).select("*").maybeSingle();
    if (updated.error) throw updated.error;
    if (!updated.data) throw new AppError("This CV was removed during analysis. Upload it again.", 404);
    return NextResponse.json({ cv: updated.data }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
