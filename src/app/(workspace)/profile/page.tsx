import { requirePageUser } from "@/lib/page-auth";
import { CvProfile } from "@/components/cv-profile";

export default async function ProfilePage() {
  const { supabase, user } = await requirePageUser();
  const { data, error } = await supabase.from("cvs").select("id,user_id,file_path,file_name,extracted_text,skills,analysis,created_at").eq("user_id", user.id).order("created_at", { ascending: false });
  return <CvProfile initialCvs={data || []} initialError={error ? "Could not load CVs. Run the Step 3 SQL migration." : ""} />;
}
