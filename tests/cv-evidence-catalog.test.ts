import test from 'node:test';
import assert from 'node:assert/strict';
import {cvEvidenceCatalog,restoreCatalogEvidence} from '../src/lib/cv-v2/evidence-catalog';
import {analyzeCv} from '../src/lib/cv-v2/analyze';
const text='Technical Skills\r\nPython and React\r\nProjects\r\nBuilt a React prototype for coursework.\r\nEducation\r\nComputer Science undergraduate.';
test('catalogue restores original PDF text without model paraphrases',()=>{
 const entries=cvEvidenceCatalog(text),id=entries.find(e=>e.text.startsWith('Built'))!.id;
 const assessment={score:1.5,explanation:'Evidence from a project',evidence:id};
 const restored=restoreCatalogEvidence({relevance:assessment,writing:assessment,feedback:[{priority:'Medium',area:'Project',issue:'Purpose could be clearer',recommendation:'Explain its actual purpose.',evidence:id,before:id,after:'Built a React prototype for coursework.'}]},entries);
 assert.equal(restored.relevance.evidence,'Built a React prototype for coursework.');
 const review=analyzeCv(text,restored);assert.equal(review.criteria.relevance.basis,'AI + evidence validation');assert.equal(review.criteria.writing.score,1.5);
 assert.ok(!review.warnings.some(w=>w.includes('not found')));
 assert.equal(review.improvements.filter(i=>i.source==='AI').length,1);
});
test('invented evidence IDs are rejected instead of approving unsupported scores',()=>{
 const entries=cvEvidenceCatalog(text),assessment={score:2,explanation:'Unsupported',evidence:'CVE9999'};
 assert.throws(()=>restoreCatalogEvidence({relevance:assessment,writing:assessment,feedback:[]},entries));
});
test('catalogue is bounded and excludes redacted contact/link markers',()=>{
 const entries=cvEvidenceCatalog('[contact details omitted]\nPortfolio [link omitted]\n'+('A'.repeat(1500)+'\n').repeat(100));
 assert.equal(entries.length,200);assert.ok(entries.every(e=>e.text.length<=600&&!e.text.includes('omitted')));
 assert.deepEqual(cvEvidenceCatalog('[contact details omitted]'),[]);
});
test('valid evidence cannot bypass existing fabricated metric rewrite checks',()=>{
 const entries=cvEvidenceCatalog(text),id=entries[3].id,assessment={score:1,explanation:'Project evidence',evidence:id};
 const ai=restoreCatalogEvidence({relevance:assessment,writing:assessment,feedback:[{priority:'High',area:'Project',issue:'Needs evidence',recommendation:'Measure actual results',evidence:id,before:id,after:'Built a React app for 500 users.'}]},entries);
 const review=analyzeCv(text,ai);assert.equal(review.improvements.find(i=>i.source==='AI')?.after,'');
});
