import { requirePageUser } from "@/lib/page-auth";
import { ApplicationTracker } from "@/components/application-tracker";
import { FeatureIntro } from "@/components/feature-intro";
export default async function ApplicationsPage() {
 const {supabase,user}=await requirePageUser();
 const [cvs,reports]=await Promise.all([supabase.from("cvs").select("id,file_name,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),supabase.from("company_reports").select("id,result").eq("user_id",user.id).order("created_at",{ascending:false}).limit(100)]);
 return <><FeatureIntro>Keep every opportunity organized by stage, add notes and dates, and connect your CV or company research to an application.</FeatureIntro><ApplicationTracker cvs={(cvs.data||[]).map(c=>({id:c.id,label:`${c.file_name} (${c.created_at.slice(0,10)})`}))} reports={(reports.data||[]).map(r=>({id:r.id,label:r.result.company_label,report:r.result}))} optionsError={Boolean(cvs.error||reports.error)} /></>;
}
