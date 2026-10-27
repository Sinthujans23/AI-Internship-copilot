import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseConfig, supabaseSetupMessage } from "./config";

export async function createClient() {
  const settings = getSupabaseConfig();
  if (!settings) throw new Error(supabaseSetupMessage);
  const { url, key } = settings;
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server components cannot write cookies; middleware refreshes them.
        }
      },
    },
  });
}
