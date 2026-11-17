import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { readJson } from "@/lib/security/request";
import { canonicalJobUrl } from "@/lib/applications";
import { feedbackSchema } from "@/lib/career/schema";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const result = await supabase.from("job_feedback").select("*").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(1000);
    if (result.error) throw new AppError("Apply the career workflows migration to load feedback.", 503);
    return NextResponse.json(result.data, { headers });
  } catch (e) { return apiError(e); }
}
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser(); const input = feedbackSchema.parse(await readJson(request));
    const result = await supabase.from("job_feedback").upsert({ ...input, job_url: canonicalJobUrl(input.job_url), user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id,job_url" });
    if (result.error) throw new AppError("Could not save job feedback. Apply the career workflows migration.", 503);
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) { return apiError(e); }
}
export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const url = z.string().url().max(2000).parse(new URL(request.url).searchParams.get("url"));
    const result = await supabase.from("job_feedback").delete().eq("user_id", user.id).eq("job_url", canonicalJobUrl(url));
    if (result.error) throw new AppError("Could not remove feedback.", 503);
    return NextResponse.json({ ok: true }, { headers });
  } catch (e) { return apiError(e); }
}
