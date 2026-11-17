import { loadCareerOptions } from "@/lib/career/options";
import { DraftDashboard } from "@/components/draft-dashboard";
export default async function DraftsPage() { return <DraftDashboard options={await loadCareerOptions()} />; }
