import {acceptedSuggestions} from "@/lib/tailoring/schema";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePageUser } from "@/lib/page-auth";
import { PdfEditor } from "@/components/pdf-editor";

export default async function PdfEditorPage({ searchParams }: { searchParams: Promise<{ cv_id?: string; report_id?: string; tailoring_id?:string }> }) {
  const { supabase, user } = await requirePageUser();
  const query = await searchParams;
  const cvId = z.string().uuid().safeParse(query.cv_id);
  if (!cvId.success) notFound();
  const cv = await supabase.from("cvs").select("id,file_name").eq("id", cvId.data).eq("user_id", user.id).maybeSingle();
  if (!cv.data) notFound();
  const reportId = z.string().uuid().safeParse(query.report_id);
  const report = reportId.success ? await supabase.from("company_reports").select("result").eq("id", reportId.data).eq("cv_id", cv.data.id).eq("user_id", user.id).maybeSingle() : null;
  const tailoringId=z.string().uuid().safeParse(query.tailoring_id);
  const tailoring=tailoringId.success?await supabase.from("cv_tailoring").select("*").eq("id",tailoringId.data).eq("cv_id",cv.data.id).eq("user_id",user.id).maybeSingle():null;
  if(query.tailoring_id&&!tailoring?.data)notFound();
  return <PdfEditor tailoringId={tailoring?.data?.id} cvId={cv.data.id} cvName={cv.data.file_name} suggestions={tailoring?.data?acceptedSuggestions(tailoring.data):report?.data?.result.coaching.cv_changes || []} />;
}
