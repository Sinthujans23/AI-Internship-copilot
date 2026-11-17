import { loadCareerOptions } from "@/lib/career/options";
import { InterviewDashboard } from "@/components/interview-dashboard";
export default async function InterviewsPage() { return <InterviewDashboard options={await loadCareerOptions()} />; }
