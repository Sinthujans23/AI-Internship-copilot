import {readJson} from "@/lib/security/request";
import { NextResponse } from "next/server";
import { requireUser, apiError, AppError } from "@/lib/api";
import { defaultPreferences, preferencesSchema } from "@/lib/company/schema";

export async function GET() {
  try {
    const { supabase, user } = await requireUser();
    const { data, error } = await supabase.from("career_preferences").select("preferences").eq("user_id", user.id).maybeSingle();
    if (error) throw new AppError("Run the company research SQL migration to save career preferences.", 503);
    const parsed = preferencesSchema.safeParse(data?.preferences);
    return NextResponse.json(parsed.success ? parsed.data : defaultPreferences, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
export async function PUT(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const preferences = preferencesSchema.parse(await readJson(request));
    const { error } = await supabase.from("career_preferences").upsert({ user_id: user.id, preferences, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) throw new AppError("Could not save preferences. Run the company research SQL migration.", 503);
    return NextResponse.json(preferences);
  } catch (error) { return apiError(error); }
}
