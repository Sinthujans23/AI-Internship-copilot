import {boundedBody} from "@/lib/security/request";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser,apiError,AppError } from "@/lib/api";
import { learningInputSchema,taskUpdateSchema } from "@/lib/learning/schema";
import { learningContext,generateRoadmap,ownedRoadmap,tasksFor,nextSteps,updateTask } from "@/lib/learning/service";
export const runtime="nodejs";export const maxDuration=120;
const headers={"Cache-Control":"private, no-store"};
export async function GET(request:Request){try{
 const {supabase,user}=await requireUser();const params=new URL(request.url).searchParams;
 const page=z.coerce.number().int().min(0).max(1000).parse(params.get("page")||0);
 const history=await supabase.from("learning_roadmaps").select("*").eq("user_id",user.id).order("created_at",{ascending:false}).order("id").range(page*20,page*20+19);
 if(history.error)throw new AppError("Run the Learning Roadmap SQL migration to load plans.",503);
 const selected=params.get("id")?await ownedRoadmap(supabase,user.id,z.string().uuid().parse(params.get("id"))):history.data[0]||null;
 const tasks=selected?await tasksFor(supabase,user.id,selected.id):[];
 let profile:Awaited<ReturnType<typeof learningContext>>|null=null,warning="";
 try{profile=await learningContext(supabase,user.id);}catch(e){warning=e instanceof AppError?e.message:"Could not load learning inputs.";}
 return NextResponse.json({plans:history.data,selected,tasks,profile,warning,has_more:history.data.length===20,page},{headers});
}catch(e){return apiError(e);}}
const action=z.discriminatedUnion("action",[
 z.object({action:z.literal("generate"),input:learningInputSchema,parent_id:z.string().uuid().nullable()}),
 z.object({action:z.literal("update"),task:taskUpdateSchema}),
 z.object({action:z.literal("recommend"),id:z.string().uuid()}),
]);
export async function POST(request:Request){try{
 const {supabase,user}=await requireUser();const raw=new TextDecoder().decode(await boundedBody(request,8000));if(raw.length>8000)throw new AppError("Request too large.",413);
 const input=action.parse(JSON.parse(raw));
 if(input.action==="generate")return NextResponse.json(await generateRoadmap(supabase,user.id,input.input,input.parent_id),{headers});
 if(input.action==="recommend")return NextResponse.json(await nextSteps(supabase,user.id,input.id),{headers});
 await updateTask(supabase,user.id,input.task);return NextResponse.json({ok:true},{headers});
}catch(e){return apiError(e);}}
