import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppError } from "@/lib/api";

// Resolve IDs through the verified user's scope before using CV/job data.
export async function applicationContext(supabase: SupabaseClient<Database>, userId: string, applicationId: string) {
  const application = await supabase.from("applications").select("*").eq("id", applicationId).eq("user_id", userId).maybeSingle();
  if (application.error) throw new AppError("Could not load application. Check database migrations.");
  if (!application.data) throw new AppError("Application not found.", 404);
  let cvQuery = supabase.from("cvs").select("*").eq("user_id", userId);
  if (application.data.cv_id) cvQuery = cvQuery.eq("id", application.data.cv_id);
  const cv = await cvQuery.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (cv.error) throw new AppError("Could not load your CV. Check database migrations.");
  if (!cv.data) throw new AppError("Upload a CV on the profile page first.", 422);
  return { application: application.data, cv: cv.data };
}
