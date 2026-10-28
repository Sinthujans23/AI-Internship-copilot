import { z } from "zod";
import { repositorySchema, usernameSchema, repoNameSchema, type Repository } from "./schema";

export class GitHubError extends Error { constructor(message:string,public status=502){super(message);} }
// Only fixed official API paths are fetched. Never follow README/download URLs or redirects.
export async function githubRequest(path:string,fetcher:typeof fetch=fetch):Promise<unknown> {
  const headers:Record<string,string>={Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28","User-Agent":"AI-Internship-Copilot"};
  if(process.env.GITHUB_TOKEN)headers.Authorization=`Bearer ${process.env.GITHUB_TOKEN}`;
  let response:Response;
  try {response=await fetcher(`https://api.github.com${path}`,{headers,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(12000)});}
  catch {throw new GitHubError("GitHub could not be reached. Retry later.");}
  if(response.status===404)throw new GitHubError("Public GitHub profile or repository not found.",404);
  if(response.status===403 || response.status===429)throw new GitHubError("GitHub denied or rate-limited this request. Wait before retrying; an optional server GitHub token can increase the public API allowance.",429);
  if(response.status===401)throw new GitHubError("The configured GitHub token was rejected. Check server configuration.",503);
  if(!response.ok)throw new GitHubError("GitHub returned an error. Retry later.");
  const reader=response.body!.getReader();const chunks:Uint8Array[]=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2_000_000)throw new GitHubError("GitHub response exceeded the safe size limit.");chunks.push(value);}}
  finally {await reader.cancel();}
  try{return JSON.parse(Buffer.concat(chunks).toString("utf8"));}catch{throw new GitHubError("GitHub returned invalid data.");}
}
export async function listRepositories(username:string,page:number,fetcher:typeof fetch=fetch){
  const user=usernameSchema.parse(username);z.number().int().min(1).max(100).parse(page);
  const raw=z.array(z.unknown()).parse(await githubRequest(`/users/${user}/repos?type=owner&sort=updated&per_page=30&page=${page}`,fetcher));
  const repositories=raw.flatMap(r=>{const p=repositorySchema.safeParse(r);return p.success && !p.data.private && p.data.owner.login.toLowerCase()===user?[p.data]:[];});
  return {repositories,next_page:raw.length===30 && page<100?page+1:null,fetched_at:new Date().toISOString(),limited:page===100 && raw.length===30};
}
export async function publicRepository(username:string,name:string,fetcher:typeof fetch=fetch):Promise<Repository>{
  const user=usernameSchema.parse(username),repo=repoNameSchema.parse(name);
  const result=repositorySchema.parse(await githubRequest(`/repos/${user}/${encodeURIComponent(repo)}`,fetcher));
  if(result.private || result.owner.login.toLowerCase()!==user || result.name!==repo)throw new GitHubError("Only public repositories owned by this username can be analyzed.",404);
  return result;
}
const selectedFiles=["package.json","requirements.txt","pyproject.toml","Dockerfile","Cargo.toml","go.mod","pom.xml","composer.json","Gemfile","pubspec.yaml"];
const fileSchema=z.object({type:z.literal("file"),encoding:z.literal("base64"),content:z.string(),size:z.number().max(64000)});
async function file(path:string,fetcher:typeof fetch){
  try {const p=fileSchema.safeParse(await githubRequest(path,fetcher));return p.success?Buffer.from(p.data.content,"base64").toString("utf8").slice(0,32000):null;}
  catch(e){if(e instanceof GitHubError && e.status===404)return null;throw e;}
}
export async function repositoryEvidence(repo:Repository,fetcher:typeof fetch=fetch){
  if(repo.private)throw new GitHubError("Private repositories are not supported.",404);
  const base=`/repos/${usernameSchema.parse(repo.owner.login)}/${encodeURIComponent(repoNameSchema.parse(repo.name))}`;
  const warnings:string[]=[];let languages:Record<string,number>={},readme="";const manifests:Record<string,string>={};
  const tasks=await Promise.allSettled([
    githubRequest(`${base}/languages`,fetcher), file(`${base}/readme`,fetcher), githubRequest(`${base}/contents`,fetcher),
  ]);
  if(tasks[0].status==="fulfilled") {const parsed=z.record(z.number().nonnegative()).safeParse(tasks[0].value);if(parsed.success)languages=parsed.data;else warnings.push("Language data unavailable.");}
  else warnings.push(tasks[0].reason instanceof GitHubError?tasks[0].reason.message:"Language data unavailable.");
  if(tasks[1].status==="fulfilled" && typeof tasks[1].value==="string")readme=tasks[1].value;
  else warnings.push("README missing, too large or unavailable. No README claims were inferred.");
  if(tasks[2].status==="fulfilled" && Array.isArray(tasks[2].value)){
    const entries=z.array(z.object({name:z.string(),type:z.string()})).safeParse(tasks[2].value);
    const available=entries.success?entries.data.filter(e=>e.type==="file").map(e=>e.name):[];
    for(const name of selectedFiles.filter(n=>available.includes(n)).slice(0,4)){
      try {const text=await file(`${base}/contents/${encodeURIComponent(name)}`,fetcher);if(text)manifests[name]=text;else warnings.push(`${name} missing or too large.`);}
      catch(e){warnings.push(e instanceof GitHubError?e.message:`${name} unavailable.`);break;}
    }
  }else warnings.push("Root dependency manifests unavailable.");
  return {languages,readme,manifests,warnings,fetched_at:new Date().toISOString()};
}
