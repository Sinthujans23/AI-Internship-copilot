import { JobDiscovery } from "@/components/job-discovery";
import { requirePageUser } from "@/lib/page-auth";
import { preferencesSchema, defaultPreferences } from "@/lib/company/schema";

export default async function JobsPage() {
  const { supabase, user } = await requirePageUser();
  const [cv, saved] = await Promise.all([
    supabase.from("cvs").select("id").eq("user_id", user.id).limit(1).maybeSingle(),
    supabase.from("career_preferences").select("preferences").eq("user_id", user.id).maybeSingle(),
  ]);
  const parsed = preferencesSchema.safeParse(saved.data?.preferences);
  const preferences = parsed.success ? parsed.data : defaultPreferences;
  return <JobDiscovery hasCv={!!cv.data} initialWarning={cv.error ? "Could not load your CV. Refresh or check CV Profile." : saved.error ? "Saved preferences could not be loaded; using the default internship search." : !parsed.success ? "No saved career preferences yet. Using Software Engineering Intern across listed locations; save your preferences in Company shortlist to personalize this." : ""} initial={{ role: preferences.target_role.slice(0, 120), location: preferences.locations[0] || "", remote: preferences.work_mode === "Remote", internships: true }} />;
}
