import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { AppError } from "../api";
import { fetchCompanySources,companyUrl } from "./website";
import { chunkSources,retrievedSources,type RetrievedChunk,type RagSummary } from "./rag-core";
import { researchCompany } from "./research";
import type { CareerPreferences } from "./schema";

export const embeddingBatchSchema=z.object({model:z.string().min(1).max(200),dimensions:z.number().int().min(1).max(3072),vectors:z.array(z.array(z.number().finite()).min(1).max(3072)).min(1).max(64)}).superRefine((r,ctx)=>{
 if(r.vectors.some(v=>v.length!==r.dimensions||!v.some(n=>n!==0)))ctx.addIssue({code:z.ZodIssueCode.custom,message:"Invalid embedding dimensions or zero vector"});
});
export async function embedResearch(texts:string[]){
 if(!process.env.MATCHING_SERVICE_URL||!process.env.MATCHING_SERVICE_API_KEY)throw new AppError("Configure and start the matching service for RAG embeddings.",503);
 let response:Response;
 try{response=await fetch(`${process.env.MATCHING_SERVICE_URL.replace(/\/$/,"")}/embed`,{method:"POST",headers:{"Content-Type":"application/json","X-API-Key":process.env.MATCHING_SERVICE_API_KEY},body:JSON.stringify({texts}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(45000)});}catch{throw new AppError("RAG embedding service unavailable. Start the matching service and retry.",503);}
 if(!response.ok)throw new AppError("RAG embeddings failed. Check matching-service provider configuration and credits.",503);
 const result=embeddingBatchSchema.parse(await response.json());if(result.vectors.length!==texts.length)throw new AppError("Incomplete research embeddings.",502);return result;
}
const hitSchema=z.object({id:z.string().uuid(),document_id:z.string().uuid(),source_index:z.number().int().min(0).max(2),source_url:z.string().url(),retrieved_at:z.string(),ordinal:z.number().int(),content:z.string(),content_hash:z.string(),similarity:z.number().finite().min(-1.001).max(1.001)});
export async function researchCompanyRag(client:SupabaseClient<Database>,userId:string,url:string,preferences:CareerPreferences,cv:{id:string;file_name:string;skills:string[];extracted_text:string}){
 const root=companyUrl(url).href;
 const {data:session,error}=await client.rpc("reserve_company_rag",{p_url:root});
 if(error)throw new AppError(error.message.includes("rate limit")?"Five company researches per hour are allowed. Saved reports remain available.":"Run the Company RAG SQL migration before researching.",error.message.includes("rate limit")?429:503);
 const sources=await fetchCompanySources(root),ids=sources.map(()=>crypto.randomUUID());
 const chunks=chunkSources(sources,ids);
 const queries=[`${preferences.target_role}: published technologies, required and preferred skills, education and experience qualifications`,`${preferences.target_role}: responsibilities, job location, remote hybrid on-site work, salary currency and application instructions`,"Company technology engineering overview and explicitly published certifications"];
 const embedded=await embedResearch([...chunks.map(c=>c.text),...queries]);
 const docs=sources.map((s,i)=>({id:ids[i],user_id:userId,session_id:session,source_url:s.url,title:s.title,source_index:i,source_kind:i===0?"primary":"related",retrieved_at:s.retrieved_at}));
 const documents=await client.from("company_rag_documents").insert(docs);
 if(documents.error)throw new AppError("Could not store research documents. Check the RAG migration.",503);
 const inserted=await client.from("company_rag_chunks").insert(chunks.map((c,i)=>({id:c.id,user_id:userId,session_id:session,document_id:c.document_id,ordinal:c.ordinal,content:c.text,content_hash:c.content_hash,embedding:JSON.stringify(embedded.vectors[i]),embedding_model:embedded.model})));
 if(inserted.error)throw new AppError("Could not store research embeddings. Check pgvector and its migration.",503);
 const retrieved=new Map<string,RetrievedChunk>();
 // Query per document as well as topic to keep secondary pages from crowding out the primary vacancy.
 for(let i=0;i<queries.length;i++){
  const searches=await Promise.all(ids.map(id=>client.rpc("retrieve_company_chunks",{p_session:session,p_model:embedded.model,p_vector:JSON.stringify(embedded.vectors[chunks.length+i]),p_document:id,p_limit:3})));
  for(const result of searches){
   if(result.error)throw new AppError("Semantic retrieval failed. Check the RAG SQL function.",503);
   for(const hit of z.array(hitSchema).parse(result.data)){
    const original=chunks.find(c=>c.id===hit.id);
    // Verify the returned citation really belongs to this user's current research snapshot.
    if(!original||original.document_id!==hit.document_id||original.source_index!==hit.source_index||original.text!==hit.content||sources[hit.source_index]?.url!==hit.source_url)throw new AppError("Invalid retrieval provenance.",502);
    if(hit.similarity<0.2)continue;
    const existing=retrieved.get(hit.id);if(!existing||existing.similarity<hit.similarity)retrieved.set(hit.id,{...original,similarity:hit.similarity,source_url:hit.source_url,retrieved_at:hit.retrieved_at});
   }
  }
 }
 const selected=[...retrieved.values()];
 const rag:RagSummary={version:1,session_id:session,model:embedded.model,dimensions:embedded.dimensions,indexed_chunks:chunks.length,retrieved_chunks:selected,documents:docs.map(d=>({id:d.id,url:d.source_url,retrieved_at:d.retrieved_at})),required_skills:[],preferred_skills:[],company_technologies:[],missing_required:[],missing_preferred:[]};
 return researchCompany(root,preferences,cv,{sources:retrievedSources(sources,selected),rag});
}
