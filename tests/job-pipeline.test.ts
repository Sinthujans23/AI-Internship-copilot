import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rankJobPool} from '../src/lib/job-pipeline';
import {jobPage} from '../src/lib/job-pagination';
import {defaultPreferences} from '../src/lib/company/schema';
const jobs=Array.from({length:135},(_,i)=>({id:String(i),title:'Python Intern',company:`Company ${i}`,location:'Colombo',remote:false,url:`https://example.com/jobs/${i}`,description:'Required skills:\nPython',source:'Fixture',published:null,skills:['Python']}));
test('pipeline keeps remaining jobs, deduplicates and removes expired listings before bounded semantic ranking',async()=>{
 const sizes:number[]=[];
 const result=await rankJobPool([...jobs,jobs[0],{...jobs[0],id:'expired',company:'Expired',url:'https://example.com/expired',expires_at:'2000-01-01'}],['Python'],defaultPreferences,async batch=>{
  sizes.push(batch.length);return Object.fromEntries(batch.map(j=>[j.id,0.8]));
 });
 assert.equal(result.jobs.length,135);
 assert.deepEqual(sizes,[30,30,30,30]);
 assert.equal(result.jobs.filter(j=>j.semantic!==null).length,120);
 assert.equal(result.jobs.filter(j=>j.semantic===null).length,15);
 assert.match(result.warnings.join(' '),/120/);
 assert.equal(new Set(result.jobs.map(j=>j.id)).size,135);
});
test('a failed semantic batch preserves every job and successful batch scores',async()=>{
 let calls=0;
 const result=await rankJobPool(jobs.slice(0,40),[],defaultPreferences,async batch=>{
  if(calls++===0)throw Error('provider down');
  return Object.fromEntries(batch.map(j=>[j.id,0.9]));
 });
 assert.equal(result.jobs.length,40);
 assert.equal(result.jobs.filter(j=>j.semantic!==null).length,10);
 assert.match(result.warnings.join(' '),/failed/);
});
test('pagination covers all results without overlap and clamps empty or filtered pages',()=>{
 const ids=[];
 for(let p=1;p<=14;p++)ids.push(...jobPage(jobs,p).items.map(j=>j.id));
 assert.equal(ids.length,135);assert.equal(new Set(ids).size,135);
 assert.equal(jobPage(jobs.slice(0,4),14).page,1);
 assert.deepEqual(jobPage([],3),{items:[],page:1,pages:1,total:0});
});
test('empty or non-internship feeds do not trigger semantic calls',async()=>{
 const result=await rankJobPool([{...jobs[0],title:'Senior Python Engineer'}],[],defaultPreferences,async()=>{
  assert.fail('No eligible candidates should reach the embedding service');
 });
 assert.deepEqual(result,{jobs:[],warnings:[]});
});
