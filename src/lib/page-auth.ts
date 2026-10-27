import { redirect } from "next/navigation";
import { requireUser, AppError } from "@/lib/api";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function requirePageUser() {
  if (!getSupabaseConfig()) redirect("/login?error=configuration");
  try { return await requireUser(); }
  catch (error) {
    if (error instanceof AppError && error.status === 401) redirect("/login");
    throw error;
  }
}
