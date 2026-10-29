import {readForm} from "@/lib/security/request";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser, apiError, AppError } from "@/lib/api";
import {acceptedSuggestions} from "@/lib/tailoring/schema";
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
    const form = await readForm(request);
    const replacement = form.get("replace_id");
    const replaceId = replacement ? z.string().uuid().parse(replacement) : null;
    const old = replaceId ? await supabase.from("cvs").select("id,file_path").eq("id", replaceId).eq("user_id", user.id).maybeSingle() : null;
    if (old?.error) throw old.error;
    if (replaceId && !old?.data) throw new AppError("The CV to replace was not found.", 404);
    const tailoringId=form.get("tailoring_id");
    let lineage={};
    if(tailoringId){
      const id=z.string().uuid().parse(tailoringId);
      const run=await supabase.from("cv_tailoring").select("*").eq("id",id).eq("user_id",user.id).maybeSingle();
      if(!run.data)throw new AppError("Tailoring session not found.",404);
      const accepted=acceptedSuggestions(run.data);
      if(!accepted.length)throw new AppError("Accept at least one suggestion before saving a tailored version.",422);
      lineage={parent_cv_id:run.data.cv_id,target_application_id:run.data.application_id,tailoring_id:id,accepted_suggestions:accepted};
    }
    const file = await prepareCvFile(form.get("file"));
    const data = await saveCvVersion(supabase, user.id, file, lineage);
    // Keep previous CV versions and their analysis history; users can delete explicitly.
    return NextResponse.json({ cv: data, preserved_previous: !!old?.data }, { status: 201 });
  } catch (error) { return apiError(error); }
}
