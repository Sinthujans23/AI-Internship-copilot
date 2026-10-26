import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
export async function GET(request: NextRequest) {
 const url=new URL(request.url);const code=url.searchParams.get("code");
 if(code){const response=NextResponse.redirect(new URL("/dashboard",url.origin));const projectUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;if(!projectUrl||!anonKey)return NextResponse.redirect(new URL("/login?error=configuration",url.origin));const supabase=createServerClient<Database>(projectUrl,anonKey,{cookies:{getAll:()=>request.cookies.getAll(),setAll(cookies){cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error)return response;}
 return NextResponse.redirect(new URL("/login?error=confirmation",url.origin));
}
