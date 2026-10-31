import {requirePageUser} from "@/lib/page-auth";
import {loadAnalytics} from "@/lib/analytics/service";
import {ReadinessDashboard} from "@/components/readiness-dashboard";
import {FeatureIntro} from "@/components/feature-intro";
export const dynamic="force-dynamic";
export default async function DashboardPage(){const {supabase,user}=await requirePageUser();return <><FeatureIntro>See your saved CV feedback, job matches, applications, and learning progress together, then choose a useful next step.</FeatureIntro><ReadinessDashboard data={await loadAnalytics(supabase,user.id)}/></>;}
