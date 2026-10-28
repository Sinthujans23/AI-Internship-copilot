import { normalizeJobicy, regionalJobs } from "../src/lib/job-feeds";
async function main(){
  const results=await Promise.allSettled([
    regionalJobs("lk"),regionalJobs("in"),
    fetch("https://jobicy.com/api/jobs?count=100&tag=intern",{signal:AbortSignal.timeout(15000)}).then(async r=>{if(!r.ok)throw new Error("Source unavailable");return normalizeJobicy(await r.json());}),
  ]);
  results.forEach((r,i)=>console.log(`${["IFS Sri Lanka","IFS India","Jobicy remote"][i]}: ${r.status==="fulfilled"?`${r.value.length} normalized listings, ${r.value.filter(j=>j.application_url).length} official application links`:"FAILED"}`));
  if(results.some(r=>r.status==="rejected"))process.exitCode=1;
}
void main();
