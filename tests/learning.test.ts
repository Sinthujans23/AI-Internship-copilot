import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { fallbackRoadmap,validateRoadmap,fallbackAdvice,validateAdvice } from "../src/lib/learning/planner";
import { generateRoadmap,ownedRoadmap,progressHash,updateTask } from "../src/lib/learning/service";
import { evidenceUrlSchema,taskUpdateSchema,type LearningContext,type LearningTask } from "../src/lib/learning/schema";
const input={target_role:"Backend Intern",weeks:3,weekly_hours:1,source_key:null};
const context:LearningContext={cv_id:"10000000-0000-4000-8000-000000000001",cv_name:"CV.pdf",current_skills:["Python"],approved_skills:[],repository_skills:[],source:null,warnings:[]};
const task:LearningTask={id:"20000000-0000-4000-8000-000000000001",user_id:"user",roadmap_id:"30000000-0000-4000-8000-000000000001",week:1,milestone:"Build example",details:fallbackRoadmap(input,context).weeks[0].tasks[0],status:"Completed",notes:"Recorded a failing test",evidence_url:"https://github.com/student/project",updated_at:"2026-10-29T00:00:00Z"};
test("roadmaps fit duration and time budgets and include measurable project checks",()=>{
 const plan=fallbackRoadmap(input,context);assert.equal(plan.weeks.length,3);
 assert.ok(plan.weeks.every(w=>w.tasks.reduce((n,t)=>n+t.minutes,0)<=51));assert.ok(plan.weeks[0].tasks[0].checks.length>=2);
 assert.equal(validateRoadmap(plan,input).weeks[0].tasks[0].kind,"Mini-project");
 assert.throws(()=>validateRoadmap({...plan,weeks:plan.weeks.slice(0,1)},input),/duration/);
 const expensive=structuredClone(plan);expensive.weeks[0].tasks[0].minutes=90;assert.throws(()=>validateRoadmap(expensive,input),/budget/);
});
test("invented resource links, invalid structure and duplicated completed tasks are rejected",()=>{
 const plan=fallbackRoadmap(input,context);assert.throws(()=>validateRoadmap({},input));
 assert.throws(()=>validateRoadmap({...plan,summary:"Visit https://invented.invalid/course"},input),/links/);
 const bad=structuredClone(plan);bad.weeks[0].tasks[0].resource_ids=["invented"] as never;assert.throws(()=>validateRoadmap(bad,input));
 assert.throws(()=>validateRoadmap(plan,input,[task]),/completed/);
 const revised=fallbackRoadmap(input,context,[task]);assert.notEqual(revised.weeks[0].tasks[0].title,task.details.title);assert.equal(task.status,"Completed");
});
test("follow-up advice uses actual progress, fits available time, and never establishes mastery",()=>{
 const advice=fallbackAdvice([task],1);assert.equal(advice.next_steps[0].action,"Follow-up practice");assert.ok(advice.next_steps[0].minutes<=51);
 validateAdvice(advice,[task],1);
 assert.throws(()=>validateAdvice({next_steps:[{...advice.next_steps[0],action:"Start next"}]},[task],1),/Progress/);
 assert.throws(()=>validateAdvice({next_steps:[{...advice.next_steps[0],task_id:"20000000-0000-4000-8000-000000000002"}]},[task]),/foreign/);
 assert.notEqual(progressHash([task]),progressHash([{...task,status:"In Progress"}]));
});
test("progress input accepts statuses and HTTPS evidence, rejects unsafe URLs",()=>{
 for(const status of ["Not Started","In Progress","Completed"])assert.ok(taskUpdateSchema.safeParse({id:task.id,status,notes:"",evidence_url:task.evidence_url,expected_updated_at:task.updated_at}).success);
 for(const url of ["javascript:alert(1)","http://example.com","https://user:secret@example.com"])assert.equal(evidenceUrlSchema.safeParse(url).success,false);
});
test("foreign roadmap and task IDs cannot reach mutation RPCs",async()=>{
 let mutations=0;const filters:string[]=[];
 const query={select(){return this;},eq(k:string,v:string){filters.push(`${k}:${v}`);return this;},async maybeSingle(){return {data:null,error:null};}};
 const client={from(){return query;},rpc(){mutations++;}} as unknown as SupabaseClient<Database>;
 await assert.rejects(ownedRoadmap(client,"owner","foreign"),/not found/);
 await assert.rejects(updateTask(client,"owner",{id:task.id,status:"Completed",notes:"",evidence_url:null,expected_updated_at:task.updated_at}),/not found/);
 assert.equal(mutations,0);assert.equal(filters.filter(s=>s==="user_id:owner").length,2);
});
test("provider failure persists a validated fallback without changing existing tasks",async()=>{
 const mutations:{name:string;args:Record<string,unknown>}[]=[];
 const client={from(table:string){const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return q;},async maybeSingle(){return {data:table==="cvs"?{id:context.cv_id,file_name:"CV.pdf",skills:["Python"],extracted_text:"Python coursework"}:null,error:null};},then(resolve:(v:unknown)=>void){return Promise.resolve({data:[],error:null}).then(resolve);}};return q;},async rpc(name:string,args:Record<string,unknown>){mutations.push({name,args});return {data:name==="save_learning_roadmap"?"saved-id":null,error:null};}} as unknown as SupabaseClient<Database>;
 const result=await generateRoadmap(client,"owner",input,null,async()=>{throw new Error("Provider unavailable");});
 assert.equal(result.mode,"deterministic");assert.equal(result.id,"saved-id");
 assert.deepEqual(mutations.map(m=>m.name),["reserve_learning_request","save_learning_roadmap"]);
 validateRoadmap(mutations[1].args.p_plan,input);
});
