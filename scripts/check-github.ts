import { listRepositories,publicRepository,repositoryEvidence } from "../src/lib/github/client";
import { analyzeProject } from "../src/lib/github/analyze";
async function main(){
 // Public GitHub example only. No CV, AI call, database mutation or credentials printed.
 const list=await listRepositories("octocat",1);
 const repo=await publicRepository("octocat","Hello-World");
 const evidence=await repositoryEvidence(repo);
 const analysis=analyzeProject(repo,evidence);
 console.log(JSON.stringify({public_repositories:list.repositories.length,has_next_page:list.next_page!==null,repository:repo.full_name,readme_found:!!evidence.readme,detected_skills:analysis.evidence.length,partial_warnings:evidence.warnings.length}));
}
main().catch(e=>{console.error(e instanceof Error?e.message:"GitHub check failed.");process.exitCode=1;});
