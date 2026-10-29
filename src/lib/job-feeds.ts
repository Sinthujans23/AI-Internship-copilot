import { unstable_cache } from "next/cache";
import { z } from "zod";
import { load } from "cheerio";
import { normalizeJobs, type PublicJob } from "./job-search";
import { skillsIn, type JobMetadata } from "./hybrid-jobs";

export type FeedJob = PublicJob & JobMetadata;
export function plainDescription(html: string) {
  const $ = load(html.slice(0, 100000)); $("script,style,iframe").remove(); $("p,li,br,h1,h2,h3,h4").prepend("\n");
  return $.text().replace(/[ \t]+/g, " ").trim().slice(0, 18000);
}
export function safeSourceUrl(value: string | undefined, host: string) {
  try { const u = new URL(value || ""); return u.protocol === "https:" && u.hostname === host && !u.username && !u.password && !u.port ? u.href : null; } catch { return null; }
}
async function sourceText(url: string) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(12000), redirect: "error" });
  if (!response.ok) throw new Error("Source unavailable");
  const reader = response.body!.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try { while (true) { const {done,value} = await reader.read(); if(done) break; size += value.length; if(size > 4_000_000) throw new Error("Feed too large"); chunks.push(value); } }
  finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString("utf8");
}
async function json(url:string) { return JSON.parse(await sourceText(url)) as unknown; }

// ITPro explicitly publishes RSS for custom dashboards. No HTML pages are scraped.
export function normalizeItpro(xml:string):FeedJob[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("Unsupported feed declaration");
  const $=load(xml,{xml:true});
  if (!$('rss > channel').length) throw new Error("Invalid internship feed");
  return $('item').slice(0,200).toArray().flatMap(item=>{
    const row=$(item), field=(name:string)=>row.children().filter((_,el)=>el.tagName===name).first().text().trim();
    const url=safeSourceUrl(field('link'),'itpro.lk');
    const company=field('dc:creator').slice(0,200);
    const headline=field('title');
    const title=(headline.endsWith(' at '+company)?headline.slice(0,-company.length-4):headline).slice(0,200);
    if(!url||!company||!title||!new URL(url).pathname.startsWith('/job/'))return [];
    const place=field('description').match(/^Location:\s*([^\r\n<]+)$/i)?.[1]?.trim()||'';
    // This is a Sri Lankan board; a remote label alone does not prove worldwide eligibility.
    const location=place && !/^remote$/i.test(place)?`${place}, Sri Lanka`:place;
    const description=plainDescription(field('content:encoded'));
    const date=Date.parse(field('pubDate'));
    return [{id:`ITPro:${url}`,title,company,location,remote:/^remote$/i.test(place),work_mode:/^remote$/i.test(place)?'Remote' as const:'Unknown' as const,url,description,source:'ITPro.lk',published:Number.isFinite(date)?new Date(date).toISOString():null,skills:skillsIn(description),salary:null,application_url:null,fetched_at:new Date().toISOString()}];
  });
}
const jobicyRow = z.object({ id:z.number(), url:z.string(), jobTitle:z.string(), companyName:z.string(), jobGeo:z.string().optional(), jobDescription:z.string(), pubDate:z.string().optional(), salaryMin:z.number().optional(), salaryMax:z.number().optional(), salaryCurrency:z.string().optional(), salaryPeriod:z.string().optional() });
export function normalizeJobicy(raw: unknown): FeedJob[] {
  return z.object({jobs:z.array(z.unknown())}).parse(raw).jobs.slice(0,100).flatMap(item => {
    const parsed = jobicyRow.safeParse(item); if (!parsed.success) return [];
    const r=parsed.data, url=safeSourceUrl(r.url,"jobicy.com"); if(!url) return [];
    const description=plainDescription(r.jobDescription);
    const salary = r.salaryMin !== undefined && r.salaryMax !== undefined && r.salaryMin >= 0 && r.salaryMax >= r.salaryMin && r.salaryCurrency && r.salaryPeriod ? { min:r.salaryMin, max:r.salaryMax, currency:r.salaryCurrency.toUpperCase(), period: ({annual:"yearly",yearly:"yearly",monthly:"monthly",hourly:"hourly"} as Record<string,string>)[r.salaryPeriod.toLowerCase()] || "unknown" } : null;
    return [{id:`Jobicy:${r.id}`,title:r.jobTitle.slice(0,200),company:r.companyName.slice(0,200),location:r.jobGeo?.slice(0,200)||"",remote:true,work_mode:"Remote" as const,url,description,source:"Jobicy",published:r.pubDate && Number.isFinite(Date.parse(r.pubDate)) ? new Date(r.pubDate).toISOString():null,skills:skillsIn(description),salary,application_url:null,fetched_at:new Date().toISOString()}];
  });
}
const smartRow = z.object({id:z.string().regex(/^[a-zA-Z0-9-]+$/), name:z.string(),company:z.object({name:z.string()}), releasedDate:z.string().optional(), location:z.object({fullLocation:z.string().optional(),remote:z.boolean().optional(),hybrid:z.boolean().optional()}).optional()});
export async function regionalJobs(country: "lk" | "in", company="IFS1"): Promise<FeedJob[]> {
  // Verified employer board. Query public postings only; never submit an application.
  if(!["IFS1","LinkedIn3","BoschGroup"].includes(company))throw new Error("Unsupported employer board");
  const base=`https://api.smartrecruiters.com/v1/companies/${company}/postings`;
  const listing=z.object({content:z.array(z.unknown())}).parse(await json(`${base}?country=${country}&limit=100&destination=PUBLIC`));
  const rows=listing.content.flatMap(r=>{const p=smartRow.safeParse(r); return p.success && /intern|trainee|student/i.test(p.data.name)?[p.data]:[];}).slice(0,15);
  const details=await Promise.allSettled(rows.map(async r=> {
    const d=z.object({applyUrl:z.string().optional(),jobAd:z.object({sections:z.record(z.string(),z.object({title:z.string().optional(),text:z.string().optional()}))}).optional()}).parse(await json(`${base}/${r.id}`));
    const description=Object.values(d.jobAd?.sections||{}).map(s=>`${s.title||""}\n${plainDescription(s.text||"")}`).join("\n").slice(0,18000);
    return {id:`SmartRecruiters:${r.id}`,title:r.name,company:r.company.name,location:r.location?.fullLocation||"",remote:r.location?.remote||false,work_mode:r.location?.hybrid?"Hybrid" as const:r.location?.remote?"Remote" as const:"Unknown" as const,url:`https://jobs.smartrecruiters.com/${company}/${r.id}`,application_url:safeSourceUrl(d.applyUrl,"jobs.smartrecruiters.com")||safeSourceUrl(d.applyUrl,"www.smartrecruiters.com"),description,source:`${r.company.name} / SmartRecruiters`,published:r.releasedDate||null,skills:skillsIn(description),fetched_at:new Date().toISOString()};
  }));
  if(details.some(d=>d.status==="rejected")) throw new Error("Incomplete regional source");
  return details.flatMap(d=>d.status==="fulfilled"?[d.value]:[]);
}
const sources: {name:string;run:()=>Promise<FeedJob[]>}[] = [
  {name:"ITPro Sri Lanka internships",run:async()=>normalizeItpro(await sourceText("https://itpro.lk/rss/all/internship"))},
  {name:"LinkedIn employer India",run:()=>regionalJobs("in","LinkedIn3")},
  {name:"Bosch India",run:()=>regionalJobs("in","BoschGroup")},
  ...["www.arbeitnow.com","www.arbeitnow.co.uk"].map(host=>({name:host,run:async()=>normalizeJobs(await json(`https://${host}/api/job-board-api`),host,host).map(j=>({...j,fetched_at:new Date().toISOString()}))})),
  {name:"Jobicy remote",run:async()=>normalizeJobicy(await json("https://jobicy.com/api/jobs?count=100&tag=intern"))},
  {name:"IFS Sri Lanka",run:()=>regionalJobs("lk")},
  {name:"IFS India",run:()=>regionalJobs("in")},
];
// Cache normalized public data only; CVs never enter the shared cache.
export async function hybridPublicJobs() {
  const results=await Promise.allSettled(sources.map(s=>unstable_cache(s.run,["public-jobs-v3",s.name],{revalidate:21600})()));
  const all=results.flatMap(r=>r.status==="fulfilled"?r.value:[]);
  const jobs=all.filter(j=>j.fetched_at && Date.parse(j.fetched_at)>Date.now()-86400000);
  const warnings=results.flatMap((r,i)=>r.status==="rejected"?[`${sources[i].name} unavailable; showing other sources only.`]:[]);
  if(jobs.length<all.length) warnings.push("Some cached listings were last checked over 24 hours ago and were omitted. Their closure status is unknown.");
  return {jobs,warnings};
}
