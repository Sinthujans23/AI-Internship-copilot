import { createHash } from "node:crypto";
import { z } from "zod";
import { factsSchema,sourcedFact,type ResearchSource,type CompanyFacts } from "./schema";
import { verifyFacts,quoteExists } from "./evidence";

export const ragFactsSchema=factsSchema.extend({required_skills:z.array(sourcedFact),preferred_skills:z.array(sourcedFact),company_technologies:z.array(sourcedFact)});
export type Chunk={id:string;document_id:string;source_index:number;text:string;ordinal:number;content_hash:string};
export type RetrievedChunk=Chunk&{similarity:number;source_url:string;retrieved_at:string};
export type RagSummary={agent?:import("./research-agent").ResearchTrace;version:1;session_id:string;model:string;dimensions:number;indexed_chunks:number;retrieved_chunks:RetrievedChunk[];documents:{id:string;url:string;retrieved_at:string}[];required_skills:z.infer<typeof sourcedFact>[];preferred_skills:z.infer<typeof sourcedFact>[];company_technologies:z.infer<typeof sourcedFact>[];missing_required:string[];missing_preferred:string[]};
export function chunkSources(sources:ResearchSource[],ids:string[],size=1400):Chunk[]{
 const chunks:Chunk[]=[];
 sources.forEach((source,index)=>{
  // Preserve paragraph/heading order. Long individual paragraphs split at a word boundary.
  let current="",ordinal=0;
  const emit=()=>{if(!current.trim())return;const text=current.trim();chunks.push({id:crypto.randomUUID(),document_id:ids[index],source_index:index,text,ordinal:ordinal++,content_hash:createHash("sha256").update(text).digest("hex")});current="";};
  for(const paragraph of source.text.split(/\n+/).map(p=>p.trim()).filter(Boolean)){
   let remaining=paragraph;
   while(remaining.length>size){emit();let cut=remaining.lastIndexOf(" ",size);if(cut<size/2)cut=size;current=remaining.slice(0,cut);emit();remaining=remaining.slice(cut).trim();}
   if(current.length+remaining.length+1>size)emit();current+=(current?"\n":"")+remaining;
  }emit();
 });
 return chunks.slice(0,60);
}
export function retrievedSources(sources:ResearchSource[],chunks:RetrievedChunk[]):ResearchSource[]{
 return sources.map((s,i)=>({...s,text:chunks.filter(c=>c.source_index===i).sort((a,b)=>a.ordinal-b.ordinal).map(c=>c.text).join("\n\n")}));
}
export function groundRagFacts(raw:z.infer<typeof ragFactsSchema>,sources:ResearchSource[],chunks:RetrievedChunk[]){
 const cited=(f:{source_index:number;quote:string})=>!/(ignore (all |previous |prior )*instructions|system prompt|you are (chatgpt|an ai)|assistant:|reveal.*(key|secret)|do not use|don't use|not required)/i.test(f.quote)&&chunks.some(c=>c.source_index===f.source_index&&c.source_url===sources[f.source_index]?.url&&quoteExists(f.quote,c.text));
 const sanitized={...raw,role:raw.role&&cited(raw.role)?raw.role:null,work_mode:raw.work_mode&&cited(raw.work_mode)?raw.work_mode:null,salary:raw.salary&&cited(raw.salary)?raw.salary:null};
 for(const key of ["technologies","locations","requirements","responsibilities","application_instructions","certifications"] as const)sanitized[key]=raw[key].filter(cited);
 const verified=verifyFacts(sanitized,sources);
 const facts=verified.scope==="unknown"?{...emptyFacts}:verified.scope==="company_general"?{...verified,role:null,locations:[],work_mode:null,salary:null,requirements:[],responsibilities:[],application_instructions:[]}:verified;
 const validSkills=(items:z.infer<typeof sourcedFact>[])=>facts.scope!=="job_post"?[]:verifyFacts({...facts,technologies:items.filter(cited)},sources).technologies;
 const preferred=validSkills(raw.preferred_skills).filter(f=>/prefer|nice.to.have|bonus|optional|desirable/i.test(f.quote)&&!/not required|not necessary/i.test(f.quote));
 const required=validSkills(raw.required_skills).filter(f=>/required|must|essential|mandatory/i.test(f.quote)&&!/prefer|nice.to.have|bonus|optional|not required|not essential|no .+ required|\bor\b/i.test(f.quote));
 const company=verifyFacts({...facts,scope:"company_general",technologies:raw.company_technologies.filter(f=>cited(f)&&!/required|preferred|must have|not use|don't use/i.test(f.quote))},sources).technologies;
 return {facts,required,preferred,company};
}
export const emptyFacts:CompanyFacts={scope:"unknown",role:null,work_mode:null,salary:null,technologies:[],locations:[],requirements:[],responsibilities:[],application_instructions:[],certifications:[]};
