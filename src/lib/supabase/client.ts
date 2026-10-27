import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseConfig, supabaseSetupMessage } from "./config";

// NEXT_PUBLIC values are the public project URL and anon key, never a secret key.
export function createClient() {
  const settings = getSupabaseConfig();
  if (!settings) throw new Error(supabaseSetupMessage);
  const { url, key } = settings;
  return createBrowserClient<Database>(url, key);
}
