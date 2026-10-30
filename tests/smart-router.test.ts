import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {routeStage,runLocalStage,aiStages} from '../src/lib/ai/router';
import {prepareApplication} from '../src/lib/agent/prepare';

const job={role:'Frontend Intern',company:'Example',skills_required:['React'],good_to_have:[],responsibilities:[]};
const match={score:75,matched_skills:['React'],missing_skills:[]};
const content={rewritten_bullets:['Built a React project.','Added tests.','Documented the project.'],email:{subject:'Intern application',body:'Dear Hiring Manager, please review my CV. [Your Name]'}};
const app={job_analysis:job,job_text:'React intern'} as Parameters<typeof prepareApplication>[0];
const cv={id:'00000000-0000-4000-8000-000000000001',file_name:'cv.pdf',skills:['React'],extracted_text:'Built a React project. Added tests. Documented the project.'} as Parameters<typeof prepareApplication>[1];
test('all registered AI features route to one structured call per compatible stage',()=>{
 for(const name of Object.keys(aiStages)){assert.equal(routeStage(name).mode,'llm');assert.equal(routeStage(name).calls,1);}
 assert.equal(routeStage('company_retrieval').calls,0);
 assert.throws(()=>routeStage('send_email'));
 assert.throws(()=>routeStage('__proto__'));
});
test('local routing executes real work without a model',async()=>{
 let calls=0;const result=await runLocalStage('company_retrieval',async()=>{calls++;return ['source evidence'];});
 assert.deepEqual(result,['source evidence']);assert.equal(calls,1);
});
test('cached job preparation combines bullets and email in exactly one generation',async()=>{
 let generations=0,matches=0;
 const result=await prepareApplication(app,cv,{
  analyze:async()=>{throw new Error('Cached job must be reused');},
  match:async()=>{matches++;return match;},
  generate:async<T>(schema:z.ZodType<T>,name:string)=>{generations++;assert.equal(name,'application_content');assert.equal(matches,1);return schema.parse(content);},
 });
 assert.equal(generations,1);assert.equal(result.match.score,75);assert.deepEqual(result.rewritten_bullets,content.rewritten_bullets);assert.deepEqual(result.email,content.email);
});
test('uncached extraction completes before match and combined generation',async()=>{
 const stages:string[]=[];
 await prepareApplication({...app,job_analysis:null},cv,{
  analyze:async()=>{stages.push('extract');return job;},
  match:async()=>{stages.push('match');return match;},
  generate:async<T>(schema:z.ZodType<T>)=>{stages.push('combined');return schema.parse(content);},
 });
 assert.deepEqual(stages,['extract','match','combined']);
});
test('invalid combined outputs fail as a unit; no fabricated partial results',async()=>{
 await assert.rejects(()=>prepareApplication(app,cv,{
  analyze:async()=>job,match:async()=>match,
  generate:async<T>(schema:z.ZodType<T>)=>schema.parse({...content,rewritten_bullets:[]}),
 }));
 await assert.rejects(()=>prepareApplication(app,cv,{
  analyze:async()=>job,match:async()=>match,
  generate:async<T>(schema:z.ZodType<T>)=>schema.parse({...content,email:{subject:'Apply',body:'word '.repeat(221)}}),
 }),/too long/);
});
test('matching failures stop the dependent paid generation',async()=>{
 let generated=false;
 await assert.rejects(()=>prepareApplication(app,cv,{
  analyze:async()=>job,match:async()=>{throw new Error('offline');},
  generate:async<T>(schema:z.ZodType<T>)=>{generated=true;return schema.parse(content);},
 }),/offline/);assert.equal(generated,false);
});
