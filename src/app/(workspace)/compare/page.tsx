import { requirePageUser } from "@/lib/page-auth";
import { CvComparison } from "@/components/cv-comparison";
export default async function ComparePage() {
  const { supabase, user } = await requirePageUser();
  const [cvs, jobs] = await Promise.all([
    supabase.from("cvs").select("id,file_name,extracted_text,parent_cv_id,target_application_id,created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("applications").select("id,company,role,cv_id").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  return <CvComparison cvs={cvs.data || []} jobs={jobs.data || []} error={cvs.error || jobs.error ? "Could not load CV comparison. Refresh to retry." : ""} />;
}
