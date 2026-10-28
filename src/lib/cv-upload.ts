import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppError } from "./api";
import { parseCvPdf } from "./parse-cv";
import { extractCvSkills } from "./cv-skills";

export async function prepareCvFile(file: unknown) {
  if (!(file instanceof File) || file.type !== "application/pdf" || !file.size || file.size > 4 * 1024 * 1024) throw new AppError("Choose a PDF file no larger than 4 MB.", 400);
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.subarray(0, 5).toString() !== "%PDF-") throw new AppError("This file is not a valid PDF.", 400);
  let text: string;
  try { text = await parseCvPdf(new Uint8Array(buffer)); }
  catch { throw new AppError("Could not read this PDF. Use an unlocked, text-based PDF.", 422); }
  if (text.length < 40) throw new AppError("No readable CV text found. Scanned image PDFs need OCR first.", 422);
  if (text.length > 50000) throw new AppError("CV text is too long. Upload a shorter CV (under 50,000 characters).", 400);
  return { buffer, text, skills: extractCvSkills(text), name: file.name.slice(0, 255) };
}
export async function saveCvVersion(client: SupabaseClient<Database>, userId: string, file: Awaited<ReturnType<typeof prepareCvFile>>) {
  const id = crypto.randomUUID();
  const path = `${userId}/${id}.pdf`;
  const upload = await client.storage.from("cvs").upload(path, file.buffer, { contentType: "application/pdf" });
  if (upload.error) throw upload.error;
  const { data, error } = await client.from("cvs").insert({ id, user_id: userId, file_path: path, file_name: file.name, extracted_text: file.text, skills: file.skills, analysis: { skills: file.skills, experience: [], projects: [], education: [], qualifications: [] } }).select("*").single();
  if (error) {
    await client.storage.from("cvs").remove([path]);
    throw error;
  }
  // Never overwrite/delete another version or attach a stale review to new text.
  return data;
}
