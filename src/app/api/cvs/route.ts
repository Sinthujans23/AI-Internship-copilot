import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { prepareCvFile, saveCvVersion } from "@/lib/cv-upload";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("cvs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const form = await request.formData();
    const replacement = form.get("replace_id");
    const replaceId = replacement ? z.string().uuid().parse(replacement) : null;
    const old = replaceId ? await supabase.from("cvs").select("id,file_path").eq("id", replaceId).eq("user_id", user.id).maybeSingle() : null;
    if (old?.error) throw old.error;
    if (replaceId && !old?.data) throw new AppError("The CV to replace was not found.", 404);
    const file = await prepareCvFile(form.get("file"));
    const data = await saveCvVersion(supabase, user.id, file);
    // Keep previous CV versions and their analysis history; users can delete explicitly.
    return NextResponse.json({ cv: data, preserved_previous: !!old?.data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
