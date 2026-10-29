import {boundedBody} from "@/lib/security/request";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser,apiError,AppError } from "@/lib/api";
import { usernameSchema,repoNameSchema,projectAnalysisSchema } from "@/lib/github/schema";
import { githubList,reserveGithub,analyzeGithub,approveGithubSkill } from "@/lib/github/service";
import { GitHubError } from "@/lib/github/client";
import { cvSkillsForProjects } from "@/lib/github/analyze";
export const runtime="nodejs";
export const maxDuration=120;
const headers={"Cache-Control":"private, no-store"};
export async function GET(){
 try{
  const {supabase,user}=await requireUser();
  const [analyses,approvals,cv]=await Promise.all([
   supabase.from("github_analyses").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).limit(30),
   supabase.from("github_skill_approvals").select("*").eq("user_id",user.id).order("approved_at",{ascending:false}).limit(200),
   supabase.from("cvs").select("id,file_name,skills,extracted_text").eq("user_id",user.id).order("created_at",{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(analyses.error||approvals.error||cv.error)throw new AppError("Could not load GitHub Intelligence. Run the GitHub SQL migration and retry.",503);
  const parsedAnalyses=analyses.data.flatMap(row=>{const p=projectAnalysisSchema.safeParse(row.result);return p.success?[p.data]:[];});
  return NextResponse.json({analyses:analyses.data,approvals:approvals.data,cv:cv.data?{id:cv.data.id,file_name:cv.data.file_name,skills:cvSkillsForProjects(cv.data.extracted_text,cv.data.skills,parsedAnalyses)}:null},{headers});
 }catch(e){return apiError(e);}
}
const action=z.discriminatedUnion("action",[
 z.object({action:z.literal("list"),username:usernameSchema,page:z.number().int().min(1).max(100)}),
 z.object({action:z.literal("analyze"),username:usernameSchema,repo:repoNameSchema}),
 z.object({action:z.literal("approve"),analysis_id:z.string().uuid(),cv_id:z.string().uuid(),skill:z.string().min(1).max(100),confirmed:z.literal(true)}),
 z.object({action:z.literal("revoke"),id:z.string().uuid()}),
]);
export async function POST(request:Request){
 try{
  const {supabase,user}=await requireUser();const text=new TextDecoder().decode(await boundedBody(request,8000));if(text.length>4096)throw new AppError("Request too large.",413);
  const input=action.parse(JSON.parse(text));
  if(input.action==="approve"){await approveGithubSkill(supabase,user.id,input.analysis_id,input.cv_id,input.skill);return NextResponse.json({ok:true},{headers});}
  if(input.action==="revoke"){const {error}=await supabase.from("github_skill_approvals").delete().eq("id",input.id).eq("user_id",user.id);if(error)throw new AppError("Could not revoke approval.",503);return NextResponse.json({ok:true},{headers});}
  await reserveGithub(supabase);
  return NextResponse.json(input.action==="list"?await githubList(input.username,input.page):await analyzeGithub(supabase,user.id,input.username,input.repo),{headers});
 }catch(e){return apiError(e instanceof GitHubError?new AppError(e.message,e.status):e);}
}
