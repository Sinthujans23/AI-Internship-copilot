import { requirePageUser } from "@/lib/page-auth";
import { CvProfile } from "@/components/cv-profile";
import { FeatureIntro } from "@/components/feature-intro";

export default async function ProfilePage() {
  const { supabase, user } = await requirePageUser();
  const { data, error } = await supabase.from("cvs").select("id,user_id,file_path,file_name,extracted_text,skills,analysis,created_at,parent_cv_id,target_application_id,tailoring_id,accepted_suggestions").eq("user_id", user.id).order("created_at", { ascending: false });
  return <><FeatureIntro>Upload your CV to review its content, keep earlier versions, and use your skills to find relevant internships.</FeatureIntro><CvProfile initialCvs={data || []} initialError={error ? "Could not load CVs. Run the Step 3 SQL migration." : ""} /></>;
}
