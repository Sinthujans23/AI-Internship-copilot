import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { extractCvSkills } from "@/lib/cv-skills";
import { parseCvPdf } from "@/lib/parse-cv";

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
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "application/pdf" || file.size === 0 || file.size > 4 * 1024 * 1024) throw new AppError("Choose a PDF file no larger than 4 MB.", 400);
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new AppError("This file is not a valid PDF.", 400);
    let text: string;
    try {
      text = await parseCvPdf(new Uint8Array(buffer));
    } catch { throw new AppError("Could not read this PDF. Use an unlocked, text-based PDF.", 422); }
    if (text.length < 40) throw new AppError("No readable CV text found. Scanned image PDFs need OCR first.", 422);
    if (text.length > 50000) throw new AppError("CV text is too long. Upload a shorter CV (under 50,000 characters).", 400);
    const skills = extractCvSkills(text);
    const id = crypto.randomUUID();
    const path = `${user.id}/${id}.pdf`;
    const upload = await supabase.storage.from("cvs").upload(path, buffer, { contentType: "application/pdf" });
    if (upload.error) throw upload.error;
    const { data, error } = await supabase.from("cvs").insert({ id, user_id: user.id, file_path: path, file_name: file.name.slice(0, 255), extracted_text: text, skills, analysis: { skills, experience: [], projects: [], education: [], qualifications: [] } }).select("*").single();
    if (error) {
      await supabase.storage.from("cvs").remove([path]);
      throw error;
    }
    // Keep the old CV until the new file and database row have both been saved.
    let warning: string | undefined;
    if (old?.data) {
      const removed = await supabase.storage.from("cvs").remove([old.data.file_path]);
      if (removed.error) warning = "New CV saved. The old CV could not be removed; delete it from the list.";
      else {
        const deleted = await supabase.from("cvs").delete().eq("id", old.data.id).eq("user_id", user.id);
        if (deleted.error) warning = "New CV saved. The old database entry could not be removed; delete it from the list.";
      }
    }
    return NextResponse.json({ cv: data, warning }, { status: 201 });
  } catch (error) { return apiError(error); }
}
