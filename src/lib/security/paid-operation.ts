import {createHash} from "node:crypto";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {Database} from "@/types/database";
import {AppError} from "../api";
import {safeEvent} from "./logging";
// No automatic retries of billable calls. A shared DB lease suppresses concurrent duplicates.
export async function paidOperation<T>(client:SupabaseClient<Database>,kind:"analyze_job"|"match"|"agent",input:unknown,work:()=>Promise<T>):Promise<T>{
 const hash=createHash("sha256").update(JSON.stringify({version:1,provider:process.env.AI_PROVIDER,model:process.env.OPENROUTER_MODEL||process.env.OPENAI_MODEL,input})).digest("hex");
 const reserved=await client.rpc("reserve_paid_operation",{p_kind:kind,p_hash:hash});
 if(reserved.error)throw new AppError(reserved.error.message.includes("BUSY")?"This request is already running. Wait before retrying.":reserved.error.message.includes("LIMIT")?"AI request limit reached. Retry later.":"Apply the production security migration before using this endpoint.",reserved.error.message.includes("BUSY")?409:reserved.error.message.includes("LIMIT")?429:503);
 const record=reserved.data as {id:string;cached:boolean;result:T};if(record.cached)return record.result;
 const started=Date.now();try{const result=await work();const finished=await client.rpc("finish_paid_operation",{p_id:record.id,p_result:result});if(finished.error)throw new AppError("Result could not be recorded. Wait before retrying.",503);safeEvent("operation_complete",200,Date.now()-started);return result;}
 catch(error){await client.rpc("finish_paid_operation",{p_id:record.id,p_result:null});safeEvent("operation_failed",error instanceof AppError?error.status:500,Date.now()-started);throw error;}
}
