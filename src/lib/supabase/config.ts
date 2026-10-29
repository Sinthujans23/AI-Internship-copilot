export const supabaseSetupMessage = "Supabase is not configured correctly. Copy the full Project URL (https://...) and public anon key from your Supabase project into .env.local, then restart the app.";

// Check configuration before the SDK can throw while rendering a page.
export function getSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key || !isPublicSupabaseKey(key)) return null;
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

export function isPublicSupabaseKey(key:string){
 if(key.startsWith("sb_secret_"))return false;
 try {const payload=JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));if(payload.role==="service_role")return false;}catch{/* Publishable/opaque keys have no JWT payload. */}
 return true;
}
