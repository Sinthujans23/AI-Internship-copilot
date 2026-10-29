import {boundedBody} from "@/lib/security/request";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { runCvReview, reviewHistory } from "@/lib/cv-v2/service";

export const runtime = "nodejs";
export const maxDuration = 90;
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const body = new TextDecoder().decode(await boundedBody(request,8000));
    if (body.length > 2048) throw new AppError("Review request is too large.", 413);
    const { cv_id, force } = z.object({ cv_id: z.string().uuid(), force: z.boolean().default(false) }).strict().parse(JSON.parse(body));
    return NextResponse.json(await runCvReview(supabase, user.id, cv_id, force), { headers });
  } catch (error) { return apiError(error); }
}
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const cvId = z.string().uuid().parse(new URL(request.url).searchParams.get("cv_id"));
    return NextResponse.json(await reviewHistory(supabase, user.id, cvId), { headers });
  } catch (error) { return apiError(error); }
}
