import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationTracker } from "@/components/application-tracker";
import { getSupabaseConfig } from "@/lib/supabase/config";

export default async function Dashboard() {
  if (!getSupabaseConfig()) {
    redirect("/login?error=configuration");
  }
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login");
  // Read fresh database rows whenever the page is opened or refreshed.
  const { data, error } = await supabase.from("applications")
    .select("id,user_id,company,role,status,job_text,job_analysis,match_score,match_result,created_at")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  return <ApplicationTracker initialApplications={data || []} initialError={error ? `Could not load applications: ${error.message}. Check that you ran the Step 1 SQL.` : ""} />;
}
