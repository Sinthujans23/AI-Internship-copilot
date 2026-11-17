import { requirePageUser } from "@/lib/page-auth";
export async function loadCareerOptions() {
  const { supabase, user } = await requirePageUser();
  const [cvs, jobs] = await Promise.all([
    supabase.from("cvs").select("id,file_name").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("applications").select("id,company,role,cv_id").eq("user_id", user.id).order("created_at", { ascending: false }),
  ]);
  return { cvs: cvs.data || [], jobs: jobs.data || [], error: cvs.error || jobs.error ? "Could not load CV/application choices. Refresh to retry." : "" };
}
