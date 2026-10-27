import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getSupabaseConfig } from "@/lib/supabase/config";

// Next.js 15 middleware refreshes sessions before server pages read them.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const settings = getSupabaseConfig();
  if (!settings) return response;
  const { url, key } = settings;
  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookies) {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: ["/dashboard/:path*", "/applications/:path*", "/jobs/:path*", "/profile/:path*", "/api/applications/:path*", "/api/analyze-job", "/api/match", "/api/agent", "/api/cvs/:path*", "/logout"],
};
