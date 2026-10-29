import {requirePageUser} from "@/lib/page-auth";
import {loadAnalytics} from "@/lib/analytics/service";
import {ReadinessDashboard} from "@/components/readiness-dashboard";
export const dynamic="force-dynamic";
export default async function DashboardPage(){const {supabase,user}=await requirePageUser();return <ReadinessDashboard data={await loadAnalytics(supabase,user.id)}/>;}
