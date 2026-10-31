import {rankHybrid, isInternshipTitle, type HybridJob, type JobMetadata} from './hybrid-jobs';
import type {PublicJob} from './job-search';
import type {CareerPreferences} from './company/schema';

// Four bounded batches preserve FastAPI's 30-job request limit.
export async function rankJobPool(jobs:(PublicJob & JobMetadata)[],skills:string[],preferences:CareerPreferences,
 evaluate:(jobs:HybridJob[])=>Promise<Record<string,number>>) {
 const candidates=rankHybrid(jobs.filter(j=>isInternshipTitle(j.title)),skills,preferences);
 const shortlist=candidates.slice(0,120);
 const batches:HybridJob[][]=[];
 for(let i=0;i<shortlist.length;i+=30)batches.push(shortlist.slice(i,i+30));
 const results=await Promise.allSettled(batches.map(evaluate));
 const semantic:Record<string,number>={};
 for(const result of results)if(result.status==='fulfilled')Object.assign(semantic,result.value);
 const warnings:string[]=[];
 if(results.some(r=>r.status==='rejected'))warnings.push('Some semantic comparisons failed. Affected jobs use skills and preferences only; see each score breakdown.');
 if(candidates.length>120)warnings.push('Semantic comparison covers the first 120 candidates selected by skills and preferences. Remaining jobs are available using skills and preferences only.');
 return {jobs:rankHybrid(candidates,skills,preferences,semantic),warnings};
}
