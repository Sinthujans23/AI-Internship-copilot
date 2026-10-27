import { requireUser } from "@/lib/api";
import { CvProfile } from "@/components/cv-profile";

export default async function ProfilePage() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("cvs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
  return <CvProfile initialCvs={data || []} initialError={error ? "Could not load CVs. Run the Step 3 SQL migration." : ""} />;
}
