import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const { id } = z.object({ id: z.string().uuid() }).parse(await request.json());
    const { data: cv, error } = await supabase.from("cvs").select("file_path").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!cv) throw new AppError("CV not found.", 404);
    const removed = await supabase.storage.from("cvs").remove([cv.file_path]);
    if (removed.error) throw removed.error;
    const deleted = await supabase.from("cvs").delete().eq("id", id).eq("user_id", user.id);
    if (deleted.error) throw deleted.error;
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
