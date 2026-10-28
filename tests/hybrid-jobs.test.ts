import test from "node:test";
import assert from "node:assert/strict";
import { rankHybrid, skillsIn, jobSkills, eligibleJobs } from "../src/lib/hybrid-jobs";
import { defaultPreferences } from "../src/lib/company/schema";
import { normalizeJobicy, safeSourceUrl } from "../src/lib/job-feeds";
import { hybridResponseSchema } from "../src/lib/hybrid-schema";
import { semanticJobs } from "../src/lib/job-semantic";
import type { PublicJob } from "../src/lib/job-search";

const job:PublicJob={id:"1",title:"Frontend Intern",company:"Example",location:"Colombo, Sri Lanka",remote:true,url:"https://example.com/jobs/1",description:"Required skills:\nReactJS and TypeScript\nNice to have:\nPython\nResponsibilities:\nUse SQL",source:"Fixture",published:null,skills:[]};
test("synonyms, requirement headings and ordinary mentions stay distinct",()=>{
  assert.deepEqual(skillsIn("React.js ReactJS React and NodeJS"),["React","Node.js"]);
  assert.deepEqual(jobSkills(job.description),{required:["TypeScript","React"],preferred:["Python"],mentioned:["SQL"]});
  assert.deepEqual(jobSkills("We build things with Python.").required,[]);
  assert.deepEqual(jobSkills("Python is not required.").required,[]);
});
test("hybrid scores keep required and preferred gaps separate and normalize available weights",()=>{
  const [r]=rankHybrid([job],["React.js"],{...defaultPreferences,target_role:"Frontend Intern"},{"1":0.8});
  assert.deepEqual(r.matched_skills,["React"]); assert.deepEqual(r.missing_required,["TypeScript"]); assert.deepEqual(r.missing_preferred,["Python"]);
  assert.equal(r.score,57); assert.equal(r.semantic,0.8);
  const [fallback]=rankHybrid([job],["React"],defaultPreferences);
  assert.equal(fallback.semantic,null); assert.match(fallback.explanations.join(" "),/unavailable/);
});
test("multiple locations, mode and comparable salary influence ranking; unknown stays unknown",()=>{
  const prefs={...defaultPreferences,target_role:"Frontend",locations:["Chennai","Colombo"],work_mode:"Hybrid" as const,salary_min:20000,salary_max:50000};
  const [r]=rankHybrid([{...job,work_mode:"Hybrid",salary:{min:30000,max:40000,currency:"LKR",period:"monthly"}}],["React"],prefs);
  assert.equal(r.components.find(c=>c.name==="Preferences")?.value,1);
  const [unknown]=rankHybrid([{...job,location:"",remote:false}],["React"],prefs);
  assert.match(unknown.explanations.join(" "),/Location unknown/); assert.match(unknown.explanations.join(" "),/Salary unknown/); assert.equal(unknown.work_mode,"Unknown");
  const [different]=rankHybrid([{...job,location:"Indianapolis, USA"}],[],{...defaultPreferences,locations:["India"]});
  assert.match(different.explanations.join(" "),/No preferred location/);
});
test("dedup canonical URLs and employer/title/location; exclude confirmed closed and expired",()=>{
  assert.equal(eligibleJobs([job,{...job,id:"2",url:job.url+"?tracking=x"},{...job,id:"3",url:"https://example.com/crosspost"}]).length,1);
  assert.equal(eligibleJobs([{...job,closed:true}]).length,0);
  assert.equal(eligibleJobs([{...job,expires_at:"2020-01-01"}]).length,0);
  assert.equal(eligibleJobs([{...job,published:"2020-01-01"}]).length,1); // Old does not prove closed.
});
test("Jobicy preserves attribution, sanitizes HTML, validates links and leaves salary unknown",()=>{
  const [r]=normalizeJobicy({jobs:[{id:1,url:"https://jobicy.com/jobs/1",jobTitle:"Intern",companyName:"Example",jobDescription:"<p>Python</p><script>bad()</script>"}]});
  assert.equal(r.salary,null); assert.equal(r.application_url,null); assert.equal(r.source,"Jobicy"); assert.ok(!r.description.includes("bad()"));
  assert.equal(safeSourceUrl("https://jobicy.com.evil.test/x","jobicy.com"),null);
  assert.equal(safeSourceUrl("javascript:alert(1)","jobicy.com"),null);
});
test("invalid persisted results and partial semantic responses are rejected",async()=>{
  assert.equal(hybridResponseSchema.safeParse({jobs:[{score:101}]}).success,false);
  const oldFetch=global.fetch,oldUrl=process.env.MATCHING_SERVICE_URL,oldKey=process.env.MATCHING_SERVICE_API_KEY;
  process.env.MATCHING_SERVICE_URL="http://127.0.0.1:8000";process.env.MATCHING_SERVICE_API_KEY="test-only";
  try { global.fetch=async()=>new Response(JSON.stringify({scores:{wrong:0.8}})); await assert.rejects(()=>semanticJobs("CV text",rankHybrid([job],[],defaultPreferences)),/Incomplete/); }
  finally {global.fetch=oldFetch;if(oldUrl===undefined)delete process.env.MATCHING_SERVICE_URL;else process.env.MATCHING_SERVICE_URL=oldUrl;if(oldKey===undefined)delete process.env.MATCHING_SERVICE_API_KEY;else process.env.MATCHING_SERVICE_API_KEY=oldKey;}
});
