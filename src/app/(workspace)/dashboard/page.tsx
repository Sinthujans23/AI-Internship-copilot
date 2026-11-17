import {requirePageUser} from "@/lib/page-auth";
import {loadAnalytics} from "@/lib/analytics/service";
import {ReadinessDashboard} from "@/components/readiness-dashboard";
import {FeatureIntro} from "@/components/feature-intro";
import {loadCareerProgress} from "@/lib/career/progress-service";
export const dynamic="force-dynamic";
export default async function DashboardPage(){const {supabase,user}=await requirePageUser();const [data,progressData]=await Promise.all([loadAnalytics(supabase,user.id),loadCareerProgress(supabase,user.id)]);return <><FeatureIntro>See your saved CV feedback, job matches, applications, and learning progress together, then choose a useful next step.</FeatureIntro><ReadinessDashboard data={data} progressData={progressData}/></>;}
