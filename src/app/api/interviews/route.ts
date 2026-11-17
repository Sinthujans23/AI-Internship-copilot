import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { readJson } from "@/lib/security/request";
import { startInterview, scoreInterview } from "@/lib/career/service";
export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), cv_id: z.string().uuid(), application_id: z.string().uuid(), request_id: z.string().uuid() }),
  z.object({ action: z.literal("score"), id: z.string().uuid(), answers: z.array(z.string().trim().min(1).max(5000)).length(5) }),
]);
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const page = z.coerce.number().int().min(0).max(1000).parse(new URL(request.url).searchParams.get("page") || 0);
    const result = await supabase.from("interview_sessions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).order("id").range(page * 20, page * 20 + 19);
    if (result.error) throw new AppError("Apply the career workflows migration to load interview history.", 503);
    return NextResponse.json({ sessions: result.data, page, has_more: result.data.length === 20 }, { headers });
  } catch (e) { return apiError(e); }
}
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(); const input = action.parse(await readJson(request));
    const result = input.action === "start" ? await startInterview(supabase, user.id, input.cv_id, input.application_id, input.request_id)
      : await scoreInterview(supabase, user.id, input.id, input.answers);
    return NextResponse.json(result, { headers });
  } catch (e) { return apiError(e); }
}
