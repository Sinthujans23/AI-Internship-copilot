import {safeEvent} from "./security/logging";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { providerErrorDetails } from "@/lib/ai/provider-error";

export class AppError extends Error {
  constructor(message: string, public status = 500) { super(message); }
}
export async function requireUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new AppError("Please log in to continue.", 401);
  return { supabase, user };
}
export function apiError(error: unknown) {
  safeEvent("api_failure", error instanceof AppError ? error.status : error instanceof z.ZodError || error instanceof SyntaxError ? 400 : 500);
  if (error instanceof OpenAI.APIError) {
    const details = providerErrorDetails(error);
    return NextResponse.json({ error: details.message }, { status: details.status });
  }
  if (error instanceof AppError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid input." }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "Send valid JSON." }, { status: 400 });
  const message = error instanceof Error ? error.message : "Unexpected error.";
  if (message.includes("not configured")) return NextResponse.json({ error: message }, { status: 503 });
  // Do not expose provider responses or database details.
  return NextResponse.json({ error: "The request could not be completed. Please retry." }, { status: 500 });
}
