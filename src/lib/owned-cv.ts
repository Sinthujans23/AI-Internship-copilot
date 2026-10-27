import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppError } from "@/lib/api";

export async function downloadOwnedCv(supabase: SupabaseClient<Database>, userId: string, cvId: string) {
  const { data: cv, error } = await supabase.from("cvs").select("id,file_name,file_path").eq("id", cvId).eq("user_id", userId).maybeSingle();
  if (error) throw new AppError("Could not load the CV record.");
  if (!cv || !cv.file_path.startsWith(`${userId}/`)) throw new AppError("CV not found.", 404);
  const downloaded = await supabase.storage.from("cvs").download(cv.file_path);
  if (downloaded.error || !downloaded.data) throw new AppError("The private CV file could not be downloaded.", 422);
  const buffer = await downloaded.data.arrayBuffer();
  if (buffer.byteLength > 4 * 1024 * 1024) throw new AppError("PDF editing supports files up to 4 MB.", 422);
  return { cv, buffer };
}
