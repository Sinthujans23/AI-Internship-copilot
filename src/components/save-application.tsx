"use client";
import {useState} from "react";
import Link from "next/link";
// Saving never submits an application to an employer.
export function SaveApplication({company,role,url,text="",cvId,reportId}:{company:string;role:string;url:string;text?:string;cvId?:string;reportId?:string}) {
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function save(){setBusy(true);try{const r=await fetch("/api/applications",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({company,role,status:"Saved",job_url:url,job_text:text.slice(0,20000),cv_id:cvId,company_report_id:reportId})});const d=await r.json();if(!r.ok)throw Error(d.error||"Save failed");setMessage("Saved.");}catch(e){setMessage(e instanceof Error?e.message:"Save failed");}finally{setBusy(false);}}
 return <div className="space-x-3"><button disabled={busy||message==="Saved."} onClick={()=>void save()} className="rounded border px-3 py-2">{busy?"Saving...":"Save job"}</button><Link href="/applications" className="underline">Open tracker</Link><p role="status">{message}</p></div>;
}
