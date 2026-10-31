import {requirePageUser} from "@/lib/page-auth";
import {TailoringDashboard} from "@/components/tailoring-dashboard";
import {FeatureIntro} from "@/components/feature-intro";
export default async function TailoringPage(){
 const {supabase,user}=await requirePageUser();
 const [cvs,jobs]=await Promise.all([supabase.from("cvs").select("id,file_name,parent_cv_id,target_application_id,tailoring_id,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),supabase.from("applications").select("id,company,role").eq("user_id",user.id).order("created_at",{ascending:false})]);
 return <><FeatureIntro>Choose a saved CV and job to get focused wording suggestions. Review each one; your original CV stays unchanged.</FeatureIntro><TailoringDashboard cvs={cvs.data||[]} jobs={jobs.data||[]} error={cvs.error||jobs.error?"Could not load CVs/jobs. Apply the tailoring migration.":""}/></>;
}
