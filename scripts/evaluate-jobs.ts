import { readFileSync } from "node:fs";
import { rankHybrid } from "../src/lib/hybrid-jobs";
import { semanticJobs } from "../src/lib/job-semantic";
import { defaultPreferences } from "../src/lib/company/schema";

type Dataset={jobs:{id:string;title:string;location:string;description:string}[];profiles:{name:string;role:string;locations:string[];skills:string[];text:string;labels:Record<string,number>}[]};
async function main() {
const dataset:Dataset=JSON.parse(readFileSync("tests/fixtures/job-ranking.json","utf8"));
const live=process.argv.includes("--semantic");
const k=3;let recallTotal=0,ndcgTotal=0;
for(const profile of dataset.profiles){
  const jobs=dataset.jobs.map(j=>({...j,company:`Fictional ${j.id}`,remote:false,url:`https://example.com/${j.id}`,source:"Synthetic evaluation only",published:null,skills:[]}));
  const preferences={...defaultPreferences,target_role:profile.role,locations:profile.locations};
  const preliminary=rankHybrid(jobs,profile.skills,preferences);
  // Optional live run exercises the actual embedding service, with only synthetic text.
  const semantic=live?await semanticJobs(profile.text,preliminary):{};
  const ranked=rankHybrid(jobs,profile.skills,preferences,semantic).slice(0,k);
  const relevant=Object.values(profile.labels).filter(v=>v>=2).length;
  const recall=ranked.filter(j=>profile.labels[j.id]>=2).length/relevant;
  const dcg=(grades:number[])=>grades.reduce((sum,g,i)=>sum+(2**g-1)/Math.log2(i+2),0);
  const ideal=dcg(Object.values(profile.labels).sort((a,b)=>b-a).slice(0,k));
  const ndcg=dcg(ranked.map(j=>profile.labels[j.id]||0))/ideal;
  recallTotal+=recall;ndcgTotal+=ndcg;
  console.log(`${profile.name}: Recall@${k}=${recall.toFixed(3)}, NDCG@${k}=${ndcg.toFixed(3)}, ranked=${ranked.map(j=>j.id).join(",")}`);
}
console.log(`${live?"LIVE EMBEDDINGS":"OFFLINE SKILL/PREFERENCE BASELINE (no semantic evaluation)"}: mean Recall@${k}=${(recallTotal/dataset.profiles.length).toFixed(3)}, mean NDCG@${k}=${(ndcgTotal/dataset.profiles.length).toFixed(3)}`);
console.log("Small synthetic dataset; these results do not establish real-world hiring or ranking performance.");
}
main().catch(()=>{console.error("Evaluation failed: check the matching service, its embedding provider and credentials. No partial metrics reported as a successful run.");process.exitCode=1;});
