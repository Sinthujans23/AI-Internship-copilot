import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { calendarDay } from "./reminders";
import { progressTrends } from "./progress";
// Page through records rather than silently relying on Supabase's default row limit.
export async function loadCareerProgress(db: SupabaseClient<Database>, userId: string) {
  const warnings: string[] = [];
  const applications: Pick<Database["public"]["Tables"]["applications"]["Row"], "id" | "role" | "company" | "status" | "application_date" | "deadline_date" | "interview_date" | "follow_up_date">[] = [];
  const history: { application_id: string; new_status: string; old_status: string | null }[] = [];
  const tasks: { status: string; updated_at: string }[] = [];
  let appsOk = true, historyOk = true, tasksOk = true;
  // Each dataset is capped at 10,000 records; reaching the cap makes derived metrics unavailable.
  await Promise.all([
    (async () => { for (let offset = 0; offset < 10000; offset += 500) {
      const r = await db.from("applications").select("id,role,company,status,application_date,deadline_date,interview_date,follow_up_date").eq("user_id", userId).order("id").range(offset, offset + 499);
      if (r.error) { appsOk = false; break; } applications.push(...r.data); if (r.data.length < 500) return;
    } appsOk = false; })(),
    (async () => { for (let offset = 0; offset < 10000; offset += 500) {
      const r = await db.from("application_history").select("application_id,new_status,old_status").eq("user_id", userId).order("id").range(offset, offset + 499);
      if (r.error) { historyOk = false; break; } history.push(...r.data); if (r.data.length < 500) return;
    } historyOk = false; })(),
    (async () => { for (let offset = 0; offset < 10000; offset += 500) {
      const r = await db.from("learning_tasks").select("status,updated_at").eq("user_id", userId).order("id").range(offset, offset + 499);
      if (r.error) { tasksOk = false; break; } tasks.push(...r.data); if (r.data.length < 500) return;
    } tasksOk = false; })(),
  ]);
  if (!appsOk) warnings.push("Application trends and reminders unavailable: query failed or exceeded 10,000 rows. Check the career workflows migration.");
  if (!historyOk) warnings.push("Interview conversion unavailable: application history is incomplete or could not be loaded.");
  if (!tasksOk) warnings.push("All-roadmap learning totals unavailable: query failed or exceeded 10,000 rows.");
  const interviews = await db.from("interview_sessions").select("id,score,created_at,completed_at").eq("user_id", userId).not("score", "is", null).order("completed_at", { ascending: false }).limit(10);
  if (interviews.error) warnings.push("Mock interview scores unavailable. Apply the career workflows migration.");
  return { warnings, applications: appsOk ? applications : null,
    trends: appsOk && historyOk ? progressTrends(applications, history, calendarDay()) : null,
    learning: tasksOk ? { total: tasks.length, completed: tasks.filter(t => t.status === "Completed").length } : null,
    interviews: interviews.error ? null : interviews.data };
}
export type CareerProgressData = Awaited<ReturnType<typeof loadCareerProgress>>;
