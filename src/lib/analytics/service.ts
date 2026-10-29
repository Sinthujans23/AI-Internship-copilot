import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/types/database";
import {createHash} from "node:crypto";
import {savedV2} from "../cv-v2/schema";
import {savedCvReview} from "../cv-review-schema";
import {hybridResponseSchema} from "../hybrid-schema";
import {applicationStatuses} from "../applications";
import {applicationTotals,progress,recentActivity} from "./metrics";
// All requests use the signed-in client (RLS) plus an explicit owner filter.
export async function loadAnalytics(db:SupabaseClient<Database>,userId:string){
 const warnings:string[]=[];
 const [cvResult,runResult,planResult,historyResult,...counts]=await Promise.all([
  db.from("cvs").select("id,file_name,skills,analysis,extracted_text,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("job_match_runs").select("id,cv_id,result,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(3),
  db.from("learning_roadmaps").select("id,target_role,created_at,cv_id").eq("user_id",userId).order("created_at",{ascending:false}).limit(1).maybeSingle(),
  db.from("application_history").select("id,event,new_status,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(15),
  ...applicationStatuses.map(status=>db.from("applications").select("id",{count:"exact",head:true}).eq("user_id",userId).eq("status",status)),
 ]);
 const cv=cvResult.data,plan=planResult.data;
 if(cvResult.error)warnings.push("CV information unavailable.");if(runResult.error)warnings.push("Job match history unavailable.");if(planResult.error)warnings.push("Learning roadmap unavailable.");if(historyResult.error)warnings.push("Application activity unavailable.");if(counts.some(c=>c.error))warnings.push("Some application counts could not be loaded; unknown counts are not zero.");
 const [approvals,tasks]=await Promise.all([
  cv?db.from("github_skill_approvals").select("skill,approved_at").eq("user_id",userId).eq("cv_id",cv.id).order("approved_at",{ascending:false}).limit(100):Promise.resolve({data:[],error:null}),
  plan?db.from("learning_tasks").select("status,updated_at").eq("user_id",userId).eq("roadmap_id",plan.id).limit(36):Promise.resolve({data:[],error:null}),
 ]);
 if(approvals.error)warnings.push("User-approved skills unavailable.");if(tasks.error)warnings.push("Learning progress unavailable.");
 const review=cv?savedV2(cv.analysis):null,legacy=cv&&!review?savedCvReview(cv.analysis):null;
 const outdated=Boolean(review&&cv&&review.input_hash!==createHash("sha256").update(cv.extracted_text).digest("hex"));
 const quality=review?{score:review.score,at:review.reviewed_at,outdated,legacy:false,categories:Object.entries(review.criteria).map(([name,v])=>({name,score:v.score,explanation:v.explanation,basis:v.basis})),ai:review.improvements.filter(i=>i.source==="AI").slice(0,3).map(i=>i.recommendation)}:legacy?{score:legacy.score,at:legacy.reviewed_at,outdated:false,legacy:true,categories:Object.entries(legacy.criteria).map(([name,v])=>({name,score:v.score,explanation:v.feedback,basis:"Legacy AI review"})),ai:legacy.improvements.slice(0,3).map(i=>i.recommendation)}:null;
 const jobs:{id:string;role:string;company:string;score:number;required:string[];preferred:string[];at:string;current:boolean}[]=[];const seen=new Set<string>();
 for(const run of runResult.data||[]){const parsed=hybridResponseSchema.safeParse(run.result);if(!parsed.success){warnings.push("An invalid job-match snapshot was omitted.");continue;}for(const j of parsed.data.jobs){if(seen.has(j.url))continue;seen.add(j.url);jobs.push({id:j.url,role:j.title,company:j.company,score:j.score,required:j.missing_required,preferred:j.missing_preferred,at:run.created_at,current:run.cv_id===cv?.id});}}
 const events=recentActivity([
 ...(cv?[{label:`CV uploaded: ${cv.file_name}`,at:cv.created_at,href:"/profile"}]:[]),
 ...(quality?[{label:"CV quality reviewed",at:quality.at,href:"/profile"}]:[]),
 ...(plan?[{label:`Learning roadmap: ${plan.target_role}`,at:plan.created_at,href:"/learning"}]:[]),
 ...(historyResult.data||[]).map(h=>({label:`${h.event}: ${h.new_status}`,at:h.created_at,href:"/applications"})),
 ...(runResult.data||[]).map(r=>({label:"Job matching snapshot saved",at:r.created_at,href:"/jobs"})),
 ...(approvals.data||[]).slice(0,3).map(a=>({label:`Skill approved: ${a.skill}`,at:a.approved_at,href:"/github"})),
 ...(tasks.data||[]).filter(t=>t.status!=="Not Started").map(t=>({label:`Learning task: ${t.status}`,at:t.updated_at,href:"/learning"})),
 ]);
 const learning=plan?{role:plan.target_role,at:plan.created_at,updated_at:(tasks.data||[]).map(t=>t.updated_at).sort().at(-1)||plan.created_at,current:plan.cv_id===cv?.id,progress:tasks.error?null:progress(tasks.data||[])}:null;
 const actions:{text:string;href:string}[]=[];
 if(!cv&&!cvResult.error)actions.push({text:"Upload a text-based CV to start your profile.",href:"/profile"});
 if(cv&&(!quality||outdated))actions.push({text:"Review your current CV to obtain a fresh quality breakdown.",href:"/profile"});
 if(cv&&!jobs.some(j=>j.current)&&!runResult.error)actions.push({text:"Find jobs to create match evidence for your current CV.",href:"/jobs"});
 if(jobs.some(j=>j.current&&j.required.length))actions.push({text:"Review required skill gaps and choose a focused learning roadmap.",href:"/learning"});
 if(learning?.progress&&learning.progress.completed<learning.progress.total)actions.push({text:"Continue an unfinished learning task and attach evidence of your work.",href:"/learning"});
 if(counts[3]?.count)actions.push({text:"Prepare project examples for applications at the Interview stage.",href:"/applications"});
 if(!actions.length)actions.push({text:"Review your saved applications and update their stages or follow-up dates.",href:"/applications"});
 return {generated_at:new Date().toISOString(),warnings:[...new Set(warnings)],cv:cv?{name:cv.file_name,at:cv.created_at,skills:cv.skills}:null,quality,approved:approvals.error?null:approvals.data||[],jobs,learning,applications:applicationTotals(counts.map(c=>c.error?null:c.count)),events,actions};
}
export type Analytics=Awaited<ReturnType<typeof loadAnalytics>>;
