import { NextResponse } from "next/server";
import { requireUser, apiError, AppError } from "@/lib/api";
import { createHash } from "node:crypto";
import { hybridPublicJobs } from "@/lib/job-feeds";
import { MATCH_VERSION, rankHybrid, skillsIn, eligibleJobs } from "@/lib/hybrid-jobs";
import { hybridResponseSchema } from "@/lib/hybrid-schema";
import { preferencesSchema, defaultPreferences } from "@/lib/company/schema";
import { semanticJobs } from "@/lib/job-semantic";

export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST() {
  try {
    const { supabase, user } = await requireUser();
    const { data: cv, error } = await supabase.from("cvs").select("id,file_name,skills,extracted_text").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (!cv) throw new AppError("Upload your CV in CV Profile before searching for matching jobs.", 422);
    const {data: saved,error:prefError}=await supabase.from("career_preferences").select("preferences").eq("user_id",user.id).maybeSingle();
    if(prefError) throw new AppError("Could not load saved career preferences.",503);
    const preferences=preferencesSchema.parse(saved?.preferences || defaultPreferences);
    const hash=createHash("sha256").update(JSON.stringify([MATCH_VERSION,cv.id,cv.extracted_text,cv.skills,preferences])).digest("hex");
    const {data:cached,error:cacheError}=await supabase.from("job_match_runs").select("result").eq("user_id",user.id).eq("context_hash",hash).gte("created_at",new Date(Date.now()-3600000).toISOString()).not("result","is",null).order("created_at",{ascending:false}).limit(1).maybeSingle();
    if(cacheError) throw new AppError("Run the hybrid job matching SQL migration in Supabase, then retry.",503);
    const parsedCache=hybridResponseSchema.safeParse(cached?.result);
    if(parsedCache.success && !parsedCache.data.warnings.length) return NextResponse.json({...parsedCache.data,jobs:eligibleJobs(parsedCache.data.jobs)},{headers:{"Cache-Control":"private, no-store"}});
    const {data:runId,error:reserveError}=await supabase.rpc("reserve_job_match",{p_cv_id:cv.id,p_hash:hash});
    if(reserveError) throw new AppError(reserveError.message.includes("rate limit")?"Job search rate limit reached. Please try later.":"Could not start job matching.",reserveError.message.includes("rate limit")?429:503);
    const feed = await hybridPublicJobs();
    const skills=[...cv.skills,...skillsIn(cv.extracted_text)];
    const candidates=rankHybrid(feed.jobs.filter(j=>/intern|trainee|working student|werkstudent|praktik/i.test(j.title)),skills,preferences).slice(0,30);
    let semantic:Record<string,number>={};
    try { semantic=await semanticJobs(cv.extracted_text,candidates); }
    catch { feed.warnings.push("Semantic matching unavailable. Showing skill and preference rankings only. Check the matching service and embedding provider credits."); }
    const result={jobs:rankHybrid(candidates,skills,preferences,semantic),warnings:feed.warnings,cv_name:cv.file_name,searched_at:new Date().toISOString(),available_count:feed.jobs.length,version:MATCH_VERSION};
    hybridResponseSchema.parse(result);
    const {error:saveError}=await supabase.from("job_match_runs").update({result}).eq("id",runId).eq("user_id",user.id);
    if(saveError) result.warnings.push("Results could not be saved. Your current recommendations are still shown.");
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiError(error); }
}
