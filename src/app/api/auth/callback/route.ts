import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { getSupabaseConfig } from "@/lib/supabase/config";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const settings = getSupabaseConfig();
  if (!settings) return NextResponse.redirect(new URL("/login?error=configuration", url.origin));
  const code = url.searchParams.get("code");
  if (code) {
    const response = NextResponse.redirect(new URL("/dashboard", url.origin));
    const supabase = createServerClient<Database>(settings.url, settings.key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
}
