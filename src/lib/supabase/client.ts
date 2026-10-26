import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// NEXT_PUBLIC values are the public project URL and anon key, never a secret key.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error("Supabase is not configured. Fill in .env.local and restart the server.");
  }
  return createBrowserClient<Database>(url, key);
}
