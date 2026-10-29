import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeItpro,regionalJobs} from '../src/lib/job-feeds';
const item=(company:string,city:string,url='https://itpro.lk/job/1/intern/')=>`<item><title>Software Intern at ${company}</title><dc:creator>${company}</dc:creator><link>${url}</link><description>Location: ${city}</description><content:encoded><![CDATA[<p>Required skills:</p><p>React</p><script>bad()</script>]]></content:encoded><pubDate>Thu, 29 Oct 2026 12:00:00 +0530</pubDate></item>`;
const feed=(items:string)=>`<rss xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>${items}</channel></rss>`;
test('public RSS retains distinct companies, title, source and Sri Lankan location',()=>{
 const jobs=normalizeItpro(feed(item('Example A','Colombo')+item('Example B','Kandy','https://itpro.lk/job/2/intern/')));
 assert.equal(jobs.length,2);assert.equal(jobs[0].title,'Software Intern');assert.equal(jobs[1].company,'Example B');
 assert.equal(jobs[0].location,'Colombo, Sri Lanka');assert.equal(jobs[0].work_mode,'Unknown');
 assert.equal(jobs[0].salary,null);assert.equal(jobs[0].application_url,null);assert.ok(!jobs[0].description.includes('bad()'));
 assert.ok(jobs[0].skills.includes('React'));assert.ok(jobs[0].published);
});
test('remote RSS location does not invent worldwide eligibility',()=>{
 const [job]=normalizeItpro(feed(item('Example','Remote')));assert.equal(job.location,'Remote');assert.equal(job.work_mode,'Remote');
});
test('unsafe links, missing companies and invalid feeds are rejected',()=>{
 assert.equal(normalizeItpro(feed(item('Example','Colombo','https://itpro.lk.evil.test/job/1/'))).length,0);
 assert.equal(normalizeItpro(feed(item('','Colombo'))).length,0);
 assert.throws(()=>normalizeItpro('<html>Error</html>'));
 assert.throws(()=>normalizeItpro('<!DOCTYPE rss>'+feed('')));
 assert.deepEqual(normalizeItpro(feed('')),[]);
});
test('arbitrary employer paths cannot become fetch destinations',async()=>{
 await assert.rejects(()=>regionalJobs('in','../../evil'),/Unsupported employer/);
});
