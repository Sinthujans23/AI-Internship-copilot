import {readJson} from "@/lib/security/request";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { preferencesSchema } from "@/lib/company/schema";
import { researchCompanyRag } from "@/lib/company/rag-service";
import { companySaveError } from "@/lib/company/save-error";

export const runtime = "nodejs";
export const maxDuration = 240;
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("company_reports").select("id,result").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
    if (error) throw new AppError("Run the company research SQL migration to load saved reports.", 503);
    return NextResponse.json(data.map(row => row.result), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const input = z.object({ url: z.string().trim().min(3).max(2000), preferences: preferencesSchema }).parse(await readJson(request));
    // Check all required columns before fetching websites or paying for analysis.
    const ready = await supabase.from("company_reports").select("id,user_id,cv_id,source_url,result,created_at").eq("user_id", user.id).limit(1);
    if (ready.error) throw new AppError("Run the company research SQL migration before starting analysis.", 503);
    const { data: cv, error } = await supabase.from("cvs").select("id,file_name,skills,extracted_text").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw new AppError("Could not load your CV. Check the SQL setup.", 503);
    if (!cv) throw new AppError("Upload your CV on the CV profile page first.", 422);
    const result = await researchCompanyRag(supabase,user.id,input.url, input.preferences, cv);
    const saved = await supabase.from("company_reports").insert({ id: result.id, user_id: user.id, cv_id: cv.id, source_url: result.source_url, result });
    if (saved.error) throw new AppError(companySaveError(saved.error.code), 503);
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    const { data, error } = await supabase.from("company_reports").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw new AppError("Could not delete the report.");
    if (!data) throw new AppError("Report not found.", 404);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
