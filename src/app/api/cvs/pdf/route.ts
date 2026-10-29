import {readJson} from "@/lib/security/request";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import { downloadOwnedCv } from "@/lib/owned-cv";
import { pdfService } from "@/lib/pdf-service";
import { pdfPageSchema, pdfEditsSchema } from "@/lib/pdf-editor-schema";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const query = new URL(request.url).searchParams;
    const cvId = z.string().uuid().parse(query.get("cv_id"));
    const page = z.coerce.number().int().min(0).max(9).parse(query.get("page") || 0);
    const { buffer } = await downloadOwnedCv(supabase, user.id, cvId);
    const response = await pdfService("inspect", { pdf_base64: Buffer.from(buffer).toString("base64"), page });
    const parsed = pdfPageSchema.safeParse(await response.json());
    if (!parsed.success) throw new AppError("The PDF service returned invalid page information. Restart the updated service.", 502);
    return NextResponse.json(parsed.data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const input = z.object({ cv_id: z.string().uuid(), edits: pdfEditsSchema }).parse(await readJson(request));
    const { buffer } = await downloadOwnedCv(supabase, user.id, input.cv_id);
    const response = await pdfService("edit", { pdf_base64: Buffer.from(buffer).toString("base64"), edits: input.edits });
    const edited = await response.arrayBuffer();
    if (edited.byteLength > 4 * 1024 * 1024 || Buffer.from(edited).subarray(0, 5).toString() !== "%PDF-") throw new AppError("The PDF service returned an invalid or oversized file.", 502);
    return new NextResponse(edited, { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="cv-preview.pdf"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
