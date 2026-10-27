import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError } from "@/lib/api";
import { downloadOwnedCv } from "@/lib/owned-cv";

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const cvId = z.string().uuid().parse(new URL(request.url).searchParams.get("cv_id"));
    const { cv, buffer } = await downloadOwnedCv(supabase, user.id, cvId);
    return new NextResponse(buffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="cv.pdf"; filename*=UTF-8''${encodeURIComponent(cv.file_name)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
