import { NextResponse } from "next/server";
import { requireUser, apiError, AppError } from "@/lib/api";
import { searchSchema, rankJobs } from "@/lib/job-search";
import { publicJobs } from "@/lib/public-job-sources";

export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    const query = searchSchema.parse(await request.json());
    const { data: cv, error } = await supabase.from("cvs").select("id,file_name,skills").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!cv) throw new AppError("Upload your CV in CV Profile before searching for matching jobs.", 422);
    const feed = await publicJobs();
    return NextResponse.json({ jobs: rankJobs(feed.jobs, cv.skills, query), warnings: feed.warnings, cv_name: cv.file_name, searched_at: new Date().toISOString(), available_count: feed.jobs.length }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
