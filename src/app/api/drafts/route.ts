import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { readJson } from "@/lib/security/request";
import { generateDrafts } from "@/lib/career/service";
import { draftSchema } from "@/lib/career/schema";
export const runtime = "nodejs";
export const maxDuration = 120;
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const page = z.coerce.number().int().min(0).max(1000).parse(new URL(request.url).searchParams.get("page") || 0);
    const result = await supabase.from("draft_packs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).order("id").range(page * 20, page * 20 + 19);
    if (result.error) throw new AppError("Apply the career workflows migration to load draft history.", 503);
    return NextResponse.json({ packs: result.data, page, has_more: result.data.length === 20 }, { headers });
  } catch (e) { return apiError(e); }
}
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const input = z.object({ cv_id: z.string().uuid(), application_id: z.string().uuid() }).parse(await readJson(request));
    return NextResponse.json(await generateDrafts(supabase, user.id, input.cv_id, input.application_id), { headers });
  } catch (e) { return apiError(e); }
}
export async function PATCH(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const input = z.object({ id: z.string().uuid(), updated_at: z.string().datetime({ offset: true }), content: draftSchema }).parse(await readJson(request));
    const result = await supabase.from("draft_packs").update({ content: input.content, updated_at: new Date().toISOString() })
      .eq("id", input.id).eq("user_id", user.id).eq("updated_at", input.updated_at).select("*").maybeSingle();
    if (result.error) throw new AppError("Could not save draft edits.", 503);
    if (!result.data) throw new AppError("Draft changed in another tab or was deleted. Reload history before saving.", 409);
    return NextResponse.json(result.data, { headers });
  } catch (e) { return apiError(e); }
}
