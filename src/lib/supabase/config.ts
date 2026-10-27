export const supabaseSetupMessage = "Supabase is not configured correctly. Copy the full Project URL (https://...) and public anon key from your Supabase project into .env.local, then restart the app.";

// Check configuration before the SDK can throw while rendering a page.
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  if (!/^https?:\/\//i.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!parsed.hostname) return null;
  } catch {
    return null;
  }
  return { url, key };
}
