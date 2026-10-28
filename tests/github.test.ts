import test from "node:test";
import assert from "node:assert/strict";
import { usernameSchema } from "../src/lib/github/schema";
import { githubRequest,listRepositories,publicRepository,repositoryEvidence } from "../src/lib/github/client";
import { analyzeProject,extractProjectSkills,compareSkills,cvSkillsForProjects } from "../src/lib/github/analyze";
import { approveGithubSkill } from "../src/lib/github/service";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
const repo={id:1,name:"student-project",full_name:"student/student-project",private:false,fork:false,archived:false,description:"A task tracker for coursework.",updated_at:"2026-10-28T00:00:00Z",default_branch:"main",owner:{login:"student"},language:"TypeScript"};
const input={languages:{TypeScript:1000},readme:"Task tracker using React. Users can organize tasks into lists.",manifests:{"package.json":JSON.stringify({dependencies:{react:"^19",pg:"^8"},description:"uses django"}),"requirements.txt":"# tensorflow is optional\nfastapi==0.100\npytest>=8"},warnings:[],fetched_at:"2026-10-28T00:00:00Z"};
const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status});
test("GitHub usernames reject URLs, paths, whitespace and invalid hyphens",()=>{
 for(const name of ["","https://github.com/test","../test","a--b","-name","name-","a b","x".repeat(40)])assert.equal(usernameSchema.safeParse(name).success,false);
 assert.equal(usernameSchema.parse(" Student-1 "),"student-1");
});
test("public repo pagination uses fixed official endpoints and excludes private or foreign rows",async()=>{
 const paths:string[]=[];
 const fetcher=(async(url)=>{paths.push(String(url));return response(paths.length===1?Array.from({length:30},(_,i)=>({...repo,id:i,name:`repo-${i}`})):[repo,{...repo,private:true},{...repo,owner:{login:"other"}}]);}) as typeof fetch;
 const first=await listRepositories("student",1,fetcher),second=await listRepositories("student",2,fetcher);
 assert.equal(first.repositories.length,30);assert.equal(first.next_page,2);assert.equal(second.repositories.length,1);assert.equal(second.next_page,null);
 assert.match(paths[1],/^https:\/\/api.github.com\/users\/student\/repos\?.*page=2$/);
 assert.equal((await listRepositories("student",1,(async()=>response([])) as typeof fetch)).repositories.length,0);
});
test("private and missing repositories, invalid JSON, network and rate errors are handled",async()=>{
 await assert.rejects(publicRepository("student",repo.name,(async()=>response({...repo,private:true})) as typeof fetch),/public/);
 for(const [status,message] of [[404,/not found/],[429,/rate-limited/],[403,/rate-limited/],[401,/token/],[500,/error/]] as const)await assert.rejects(githubRequest("/users/student/repos",(async()=>response({},status)) as typeof fetch),message);
 await assert.rejects(githubRequest("/users/student/repos",(async()=>{throw new Error("secret provider content");}) as typeof fetch),/could not be reached/);
 await assert.rejects(githubRequest("/users/student/repos",(async()=>new Response("not JSON")) as typeof fetch),/invalid data/);
});
test("missing README and empty repository retain partial language evidence",async()=>{
 const fetched=await repositoryEvidence(repo,(async(url)=>String(url).endsWith("/languages")?response({TypeScript:10}):response({},404)) as typeof fetch);
 assert.equal(fetched.readme,"");assert.ok(fetched.warnings.some(s=>s.includes("README")));assert.equal(fetched.languages.TypeScript,10);
});
test("selected manifests are decoded without fetching README links or arbitrary root files",async()=>{
 const paths:string[]=[];
 const fetched=await repositoryEvidence(repo,(async(url)=>{
  const path=String(url);paths.push(path);
  if(path.endsWith("/languages"))return response({JavaScript:100});
  if(path.endsWith("/readme"))return response({type:"file",encoding:"base64",content:Buffer.from("https://localhost/secret").toString("base64"),size:24});
  if(path.endsWith("/contents"))return response([{name:"package.json",type:"file"},{name:".env",type:"file"},{name:"requirements.txt",type:"symlink"}]);
  return response({type:"file",encoding:"base64",content:Buffer.from('{"dependencies":{"react":"19"}}').toString("base64"),size:31});
 }) as typeof fetch);
 assert.equal(Object.keys(fetched.manifests).length,1);assert.equal(paths.length,4);assert.ok(paths.every(p=>p.startsWith("https://api.github.com/")));assert.ok(!paths.some(p=>p.endsWith(".env")));
});
test("technology detection separates dependency declarations, language bytes and documentation mentions",()=>{
 const evidence=extractProjectSkills(input);
 assert.ok(evidence.some(e=>e.skill==="React"&&e.kind==="dependency"));assert.ok(evidence.some(e=>e.skill==="React"&&e.kind==="readme"));
 assert.ok(evidence.some(e=>e.skill==="FastAPI"));assert.ok(evidence.some(e=>e.skill==="PostgreSQL"));assert.ok(!evidence.some(e=>e.skill==="TensorFlow"||e.skill==="Django"));
});
test("CV comparison recognizes detected technologies outside the legacy skill catalogue",()=>{
 const result=analyzeProject(repo,{...input,manifests:{"package.json":'{"devDependencies":{"jest":"29"},"dependencies":{"redis":"4"}}'}});
 const skills=cvSkillsForProjects("Tested with Jest. Studied redistribution.",[],[result]);
 assert.ok(skills.includes("Jest"));assert.ok(!skills.includes("Redis"));
});
test("AI claims require exact evidence; fork/proficiency warnings and deterministic fallback remain",()=>{
 const analyzed=analyzeProject({...repo,fork:true},input,{purpose_quote:"Invented purpose",functionality_quotes:["Invented achievement: doubled revenue","Users can organize tasks into lists."],improvements:["tests"]});
 assert.equal(analyzed.purpose,repo.description);assert.deepEqual(analyzed.functionality,["Users can organize tasks into lists."]);assert.ok(analyzed.warnings.some(s=>s.includes("Forked")));assert.ok(!analyzed.cv_suggestion.includes("implemented"));
 assert.equal(analyzeProject(repo,input,{malformed:true}).mode,"deterministic");
 const comparison=compareSkills(analyzed,["ReactJS","Java"],"Required: React and SQL");assert.ok(comparison.shared.includes("React"));assert.ok(comparison.missing_from_cv.includes("TypeScript"));assert.deepEqual(comparison.cv_without_repo_evidence,["Java"]);
});
test("foreign/missing CV or analysis blocks approval before insertion",async()=>{
 const filters:string[]=[];let inserted=false;
 const query={select(){return this;},eq(k:string,v:string){filters.push(`${k}:${v}`);return this;},async maybeSingle(){return {data:null,error:null};},insert(){inserted=true;}};
 const client={from(){return query;}} as unknown as SupabaseClient<Database>;
 await assert.rejects(approveGithubSkill(client,"current-user","foreign-analysis","foreign-cv","Python"),/not found/);
 assert.equal(inserted,false);assert.equal(filters.filter(s=>s==="user_id:current-user").length,2);
});
test("approval rejects invented skills and never mutates the CV",async()=>{
 let writes=0;const tables:string[]=[];
 const client={from(table:string){tables.push(table);return {select(){return this;},eq(){return this;},async maybeSingle(){return {data:table==="cvs"?{id:"owned-cv"}:{result:analyzeProject(repo,input)},error:null};},async insert(){writes++;return {error:null};}};}} as unknown as SupabaseClient<Database>;
 await assert.rejects(approveGithubSkill(client,"user","analysis","owned-cv","InventedSkill"),/no evidence/);assert.equal(writes,0);
 await approveGithubSkill(client,"user","analysis","owned-cv","React");assert.equal(writes,1);assert.equal(tables.at(-1),"github_skill_approvals");
});
