import test from "node:test";
import assert from "node:assert/strict";
import { normalizeJobs, rankJobs, searchSchema } from "../src/lib/job-search";
import { platformSearches } from "../src/lib/job-search-links";
const row = {slug:'python-intern',title:'Python Intern',company_name:'Example',description:'<p>Python SQL</p><script>secret()</script>',location:'London, UK',remote:true,url:'https://www.arbeitnow.com/jobs/python-intern',created_at:1700000000};
const query = {role:'Python',location:'',remote:false,internships:true};
test('public jobs discard unsafe links and strip executable HTML',()=>{
 const jobs=normalizeJobs({data:[row,{...row,url:'javascript:alert(1)'},{...row,url:'https://evil.example/job'},{}]},'Arbeitnow','www.arbeitnow.com');
 assert.equal(jobs.length,1); assert.ok(!jobs[0].description.includes('secret')); assert.ok(!jobs[0].description.includes('<p>'));
});
test('CV keyword ranking filters locations, remote and senior roles; unknown is not a zero match',()=>{
 const jobs=normalizeJobs({data:[row,{...row,slug:'other',url:row.url+'2',description:'No recognizable skill',title:'Python Intern'},{...row,slug:'senior',url:row.url+'3',title:'Python Senior Engineer'}]},'Arbeitnow','www.arbeitnow.com');
 const ranked=rankJobs([...jobs,jobs[0]],['Python'],query);
 assert.equal(ranked.length,2); assert.equal(ranked[0].overlap,50); assert.deepEqual(ranked[0].matched_skills,['Python']); assert.equal(ranked[1].overlap,null);
 assert.equal(rankJobs(jobs,['Python'],{...query,location:'Colombo'}).length,0);
 assert.equal(rankJobs([{...jobs[0],remote:false}],['Python'],{...query,remote:true}).length,0);
});
test('external searches encode role/location without sending CV text; search input is bounded',()=>{
 const links=platformSearches({...query,role:'C++ & React',location:'Colombo'});
 const linkedin=new URL(links[0].url); assert.equal(linkedin.searchParams.get('keywords'),'C++ & React internship'); assert.equal(linkedin.searchParams.get('location'),'Colombo');
 assert.throws(()=>searchSchema.parse({...query,role:'x'.repeat(121)}));
});
