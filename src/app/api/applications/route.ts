import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { applicationSchema, statusUpdateSchema } from "@/lib/applications";

// Select only the Step 1 columns, including when upgrading the old schema.
const columns = "id,user_id,company,role,status,job_text,job_analysis,match_score,created_at";
export const dynamic = "force-dynamic";

function failure(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: "Send valid JSON." }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Application service unavailable.";
  return NextResponse.json({ error: message }, { status: message.includes("not configured") ? 503 : 500 });
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const { data, error } = await supabase.from("applications").select(columns)
      .eq("user_id", user.id).order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const input = applicationSchema.parse(await request.json());
    // Never accept a user_id from the browser; use the verified user's ID.
    const { data, error } = await supabase.from("applications")
      .insert({ ...input, user_id: user.id }).select(columns).single();
    if (error) throw new Error(error.message);
    return NextResponse.json(data, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const input = statusUpdateSchema.parse(await request.json());
    const { data, error } = await supabase.from("applications").update({ status: input.status })
      .eq("id", input.id).eq("user_id", user.id).select(columns).maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: "Please log in." }, { status: 401 });
    const id = z.string().uuid().parse(new URL(request.url).searchParams.get("id"));
    const { data, error } = await supabase.from("applications").delete()
      .eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: "Application not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) { return failure(error); }
}
