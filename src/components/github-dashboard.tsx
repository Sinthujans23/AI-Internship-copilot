"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { usernameSchema,projectAnalysisSchema,type ProjectAnalysis,type Repository } from "@/lib/github/schema";
import { compareSkills } from "@/lib/github/analyze";

type Saved={id:string;result:ProjectAnalysis};
type Approval={id:string;analysis_id:string;cv_id:string;skill:string};
type Cv={id:string;file_name:string;skills:string[]};
const button="rounded bg-violet-700 px-3 py-2 text-white disabled:opacity-50";
async function api(body?:unknown){
 const response=await fetch("/api/github",body?{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}:{cache:"no-store"});
 const data=await response.json();if(!response.ok)throw new Error(data.error||"GitHub request failed.");return data;
}
export function GitHubDashboard(){
 const [username,setUsername]=useState("");const [listedUser,setListedUser]=useState("");
 const [repos,setRepos]=useState<Repository[]>([]);const [nextPage,setNextPage]=useState<number|null>(null);
 const [saved,setSaved]=useState<Saved[]>([]);const [approvals,setApprovals]=useState<Approval[]>([]);const [cv,setCv]=useState<Cv|null>(null);
 const [busy,setBusy]=useState(true);const [error,setError]=useState("");const [status,setStatus]=useState("");const [job,setJob]=useState("");
 async function reload(){const data=await api();setSaved(data.analyses.flatMap((r:{id:string;result:unknown})=>{const parsed=projectAnalysisSchema.safeParse(r.result);return parsed.success?[{id:r.id,result:parsed.data}]:[];}));setApprovals(data.approvals);setCv(data.cv);}
 useEffect(()=>{void reload().catch(e=>setError(e.message)).finally(()=>setBusy(false));},[]);
 async function perform(fn:()=>Promise<void>){setBusy(true);setError("");setStatus("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"Request failed.");}finally{setBusy(false);}}
 async function list(page=1){await perform(async()=>{
  const parsed=usernameSchema.safeParse(page===1?username:listedUser);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message||"Enter a valid GitHub username.");
  const user=parsed.data;const data=await api({action:"list",username:user,page});
  setRepos(current=>page===1?data.repositories:[...current,...data.repositories.filter((r:Repository)=>!current.some(c=>c.id===r.id))]);setListedUser(user);setNextPage(data.next_page);
  setStatus(data.limited?"Pagination limit reached (3,000 repositories). Narrow this review to selected projects.":`Public repository snapshot fetched ${new Date(data.fetched_at).toLocaleString()}.`);
 });}
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setStatus("Copied draft. Verify it before using it in your CV.");}catch{setError("Clipboard unavailable. Select and copy the displayed text manually.");}}
 const ranked=[...saved].sort((a,b)=>compareSkills(b.result,cv?.skills||[],job).job_shared.length-compareSkills(a.result,cv?.skills||[],job).job_shared.length);
 return <div className="space-y-6">
  <header><h1 className="text-3xl font-bold">GitHub Project Intelligence</h1><p className="mt-2 text-slate-600">Inspect public project evidence and prepare truthful CV additions. Username entry does not verify account ownership or personal proficiency.</p></header>
  <form onSubmit={e=>{e.preventDefault();void list();}} className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-5">
   <label className="grow">GitHub username<input required maxLength={39} value={username} onChange={e=>setUsername(e.target.value)} placeholder="your-github-username" className="mt-1 block w-full rounded border p-2" /></label>
   <button disabled={busy} className={button}>Load public repositories</button>
   <p className="w-full text-sm text-slate-600">Analyze sends public description/README excerpts to your configured AI provider. No private repositories, OAuth connection or code execution. Metadata is cached for one hour.</p>
  </form>
  {busy&&<p role="status">Loading GitHub intelligence...</p>}{error&&<p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}{status&&<p role="status" className="rounded bg-violet-50 p-3">{status}</p>}
  {listedUser&&<section className="space-y-3"><h2 className="text-xl font-semibold">Public repositories: {listedUser}</h2>{!repos.length&&<p>No public repositories available. Private repositories are excluded.</p>}
   <div className="grid gap-4 sm:grid-cols-2">{repos.map(repo=><article key={repo.id} className="space-y-2 rounded-xl border bg-white p-4"><h3 className="font-semibold"><a className="text-violet-700 underline" target="_blank" rel="noopener noreferrer" href={`https://github.com/${listedUser}/${encodeURIComponent(repo.name)}`}>{repo.name}</a></h3><p className="text-sm">{repo.description||"No description supplied."}</p><p className="text-sm text-slate-500">{repo.language||"Language unknown"} | {repo.fork?"Fork":"Repository"} {repo.archived?"| Archived":""} | Updated {repo.updated_at.slice(0,10)}</p><button disabled={busy} className={button} onClick={()=>void perform(async()=>{await api({action:"analyze",username:listedUser,repo:repo.name});await reload();setStatus("Analysis saved. Review the evidence and suggestions below.");})}>Analyze project</button></article>)}</div>
   {nextPage&&<button disabled={busy} className={button} onClick={()=>void list(nextPage)}>Load next page</button>}
  </section>}
  <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">CV comparison and job relevance</h2>
   <p>{cv?`Comparing with latest CV: ${cv.file_name}`:"Upload a CV to compare skills and approve additions."} <Link className="text-violet-700 underline" href="/profile">CV Profile</Link></p>
   <label className="block">Optional job requirements<textarea rows={3} maxLength={10000} value={job} onChange={e=>setJob(e.target.value)} className="mt-1 w-full rounded border p-2" placeholder="Paste a specific job's skill requirements to prioritize relevant projects." /></label><p className="text-xs text-slate-600">Projects sort by shared recognized technologies; this is evidence relevance, not proof you meet a job requirement.</p>
  </section>
  {!saved.length&&!busy&&<p>No saved project analyses yet. Load repositories and analyze a project.</p>}
  {ranked.map(row=><ProjectCard key={row.id} row={row} cv={cv} job={job} busy={busy} approvals={approvals.filter(a=>a.analysis_id===row.id&&a.cv_id===cv?.id)} onCopy={copy} onApprove={skill=>perform(async()=>{if(!cv)return;await api({action:"approve",analysis_id:row.id,cv_id:cv.id,skill,confirmed:true});await reload();setStatus("Skill addition approved and saved as a draft. Your PDF and matching skills are unchanged.");})} onRevoke={id=>perform(async()=>{await api({action:"revoke",id});await reload();})} />)}
 </div>;
}
function ProjectCard({row,cv,job,busy,approvals,onCopy,onApprove,onRevoke}:{row:Saved;cv:Cv|null;job:string;busy:boolean;approvals:Approval[];onCopy:(s:string)=>Promise<void>;onApprove:(s:string)=>Promise<void>;onRevoke:(s:string)=>Promise<void>}){
 const [confirmed,setConfirmed]=useState(false);const analysis=row.result;const comparison=compareSkills(analysis,cv?.skills||[],job);
 const skills=[...new Set(analysis.evidence.map(e=>e.skill))];
 return <article className="space-y-4 rounded-xl border bg-white p-5">
  <h2 className="text-xl font-bold">{analysis.repository.full_name}</h2><p className="text-xs text-slate-500">{analysis.mode} | Analyzed {new Date(analysis.analyzed_at).toLocaleString()} | Repository snapshot {new Date(analysis.fetched_at).toLocaleString()}</p>
  {analysis.warnings.map((w,i)=><p key={i} className="text-sm text-amber-800">{w}</p>)}
  <p className="whitespace-pre-wrap">Documented purpose: {analysis.purpose}</p>
  {!!analysis.functionality.length&&<ul className="list-disc space-y-1 pl-5">{analysis.functionality.map((q,i)=><li key={i} className="whitespace-pre-wrap">README/description quote: {q}</li>)}</ul>}
  <div className="flex flex-wrap gap-2">{skills.map(skill=><span key={skill} className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800">{skill}</span>)}</div>
  {!skills.length&&<p>No supported technologies could be detected from the available sources.</p>}
  <details><summary className="cursor-pointer font-medium">Inspect evidence (not a proficiency rating)</summary><ul className="mt-3 space-y-3">{analysis.evidence.map((e,i)=><li key={i} className="rounded bg-slate-50 p-3 text-sm"><strong>{e.skill}</strong> | {e.source} | {e.kind==="readme"?"Documentation mention only":e.kind==="dependency"?"Dependency declared; actual usage unverified":"Language bytes detected; authorship unverified"}<pre className="mt-1 whitespace-pre-wrap break-words font-sans">{e.quote}</pre></li>)}</ul></details>
  {cv&&<div className="space-y-2 text-sm"><p>Also in CV: {comparison.shared.join(", ")||"None recognized"}</p><p>Detected but missing from CV: {comparison.missing_from_cv.join(", ")||"None"}</p><p>CV skills without evidence in this repository: {comparison.cv_without_repo_evidence.join(", ")||"None"}. This does not disprove your skills.</p></div>}
  {job&&<p>Relevant technologies for the supplied job: {comparison.job_shared.join(", ")||"None recognized"}</p>}
  <h3 className="font-semibold">Recommended improvements</h3><ul className="list-disc space-y-1 pl-5 text-sm">{analysis.improvements.map(i=><li key={i}>{i}</li>)}</ul>
  <h3 className="font-semibold">Review a CV project draft</h3><p className="rounded bg-slate-50 p-3 text-sm">{analysis.cv_suggestion}</p><button className="rounded border px-3 py-2" onClick={()=>void onCopy(analysis.cv_suggestion)}>Copy project draft</button>
  {cv&&<div className="space-y-3 border-t pt-4"><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} />I will approve only skills I personally used and can explain. Repository detection alone does not verify my contribution.</label>
   <div className="flex flex-wrap gap-2">{skills.filter(s=>comparison.missing_from_cv.includes(s)&&!approvals.some(a=>a.skill===s)).map(skill=><button key={skill} disabled={busy||!confirmed} className={button} onClick={()=>void onApprove(skill)}>Approve {skill} addition</button>)}</div>
   <p className="text-sm">Approved draft skills for {cv.file_name}: {approvals.map(a=>a.skill).join(", ")||"None"}</p>
   {approvals.map(a=><button key={a.id} disabled={busy} className="mr-2 rounded border px-2 py-1 text-sm" onClick={()=>void onRevoke(a.id)}>Revoke {a.skill}</button>)}
   {!!approvals.length&&<button className="rounded border px-3 py-2" onClick={()=>void onCopy(`Skills to review for my CV: ${approvals.map(a=>a.skill).join(", ")}`)}>Copy approved skills</button>}
   <p className="text-xs text-slate-600">Approvals save suggestions only. Review your contribution and manually edit your CV using the <Link className="underline" href="/profile/pdf">PDF editor</Link>. Matching never treats these drafts as verified CV skills.</p>
  </div>}
 </article>;
}
