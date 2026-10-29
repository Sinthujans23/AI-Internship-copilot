import test from "node:test";
import assert from "node:assert/strict";
import {progress,applicationTotals,gaps,recentActivity,freshness} from "../src/lib/analytics/metrics";
import {loadAnalytics} from "../src/lib/analytics/service";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "../src/types/database";
function mock(fail=false,populated=false){const requests:{table:string;filters:[string,unknown][]}[]=[];const db={from(table:string){const req={table,filters:[] as [string,unknown][]};requests.push(req);const q={select(){return q;},eq(k:string,v:unknown){req.filters.push([k,v]);return q;},order(){return q;},limit(){return q;},maybeSingle(){return Promise.resolve({data:populated?(table==="cvs"?{id:"cv-a",file_name:"CV.pdf",skills:["Python"],analysis:{},extracted_text:"Private source CV content",created_at:"2026-10-29T00:00:00Z"}:table==="learning_roadmaps"?{id:"plan-a",target_role:"Developer",cv_id:"cv-a",created_at:"2026-10-29T00:00:00Z"}:null):null,error:fail?{}:null});},then(resolve:(v:unknown)=>unknown){return Promise.resolve({data:populated?(table==="learning_tasks"?[{status:"Completed",updated_at:"2026-10-29T01:00:00Z"}]:table==="github_skill_approvals"?[{skill:"Python",approved_at:"2026-10-29T00:00:00Z"}]:[]):[],count:fail?null:0,error:fail?{}:null}).then(resolve);}};return q;}} as unknown as SupabaseClient<Database>;return {db,requests};}
test("analytics computes progress, unknown totals and role-specific gaps",()=>{assert.deepEqual(progress([]),{total:0,completed:0,in_progress:0,percent:0});assert.equal(progress([{status:"Completed"},{status:"In Progress"},{status:"Not Started"}]).percent,33);assert.equal(applicationTotals([1,2,3,4,0,0,1]).total,11);assert.equal(applicationTotals([1,null,0,0,0,0,0]).total,null);assert.deepEqual(gaps([{role:"API",required:["Python"],preferred:["SQL"]},{role:"UI",required:["React"],preferred:[]}],"API"),{required:["Python"],preferred:["SQL"]});});
test("timeline sorts actual dates and freshness is explicit",()=>{assert.equal(recentActivity([{label:"bad",at:"invalid",href:"/"},{label:"old",at:"2026-01-01",href:"/"},{label:"new",at:"2026-02-01",href:"/"}])[0].label,"new");assert.match(freshness("2026-01-01",Date.parse("2026-02-01")),/Older/);});
test("empty analytics never fabricates scores and scopes every query to owner",async()=>{const {db,requests}=mock();const data=await loadAnalytics(db,"owner-a");assert.equal(data.cv,null);assert.equal(data.quality,null);assert.equal(data.learning,null);assert.equal(data.jobs.length,0);assert.equal(data.applications.total,0);assert.ok(data.actions.some(a=>a.href==="/profile"));assert.ok(requests.every(r=>r.filters.some(([k,v])=>k==="user_id"&&v==="owner-a")));assert.equal(requests.filter(r=>r.table==="applications").length,7);});
test("partial failures produce warnings and unknown counts, not zeros",async()=>{const {db}=mock(true);const data=await loadAnalytics(db,"owner");assert.equal(data.applications.total,null);assert.ok(data.applications.stages.every(s=>s.count===null));assert.ok(data.warnings.length>=4);});

import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {ReadinessDashboard} from "../src/components/readiness-dashboard";
import Loading from "../src/app/(workspace)/dashboard/loading";
test("dashboard renders useful empty states and accessible loading status",async()=>{
 const data=await loadAnalytics(mock().db,"owner");
 const html=renderToStaticMarkup(React.createElement(ReadinessDashboard,{data}));
 assert.match(html,/No saved quality review/);assert.match(html,/No scored mock interview sessions/);assert.match(html,/No saved roadmap/);assert.match(html,/No recorded activity/);assert.match(html,/No new AI call/);
 const loading=renderToStaticMarkup(React.createElement(Loading));assert.match(loading,/role="status"/);assert.match(loading,/aria-busy="true"/);
});

test("dependent CV/roadmap queries remain owner-scoped and private CV text stays server-side",async()=>{
 const {db,requests}=mock(false,true);const data=await loadAnalytics(db,"owner-a");
 assert.equal(data.learning?.progress?.percent,100);assert.equal(data.approved?.[0].skill,"Python");
 assert.ok(requests.every(r=>r.filters.some(([k,v])=>k==="user_id"&&v==="owner-a")));
 assert.ok(requests.find(r=>r.table==="github_skill_approvals")?.filters.some(([k,v])=>k==="cv_id"&&v==="cv-a"));
 assert.ok(requests.find(r=>r.table==="learning_tasks")?.filters.some(([k,v])=>k==="roadmap_id"&&v==="plan-a"));
 assert.ok(!JSON.stringify(data).includes("Private source CV content"));
});
