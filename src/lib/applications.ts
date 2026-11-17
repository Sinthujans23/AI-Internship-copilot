import { z } from "zod";
import type { Database } from "@/types/database";
import { jobSchema } from "@/lib/job-schema";

// Share allowed statuses between the form and API validation.
export const applicationStatuses = ["Saved", "Applied", "Assessment", "Interview", "Offer", "Rejected", "Withdrawn"] as const;
export function canonicalJobUrl(value: string) {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
  url.hash = ""; url.searchParams.sort();
  return url.toString();
}
function safeJobUrl(value: string) {
  try {const url=new URL(value);return ["http:","https:"].includes(url.protocol) && !url.username && !url.password;} catch {return false;}
}
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v, "Invalid date").nullable();
export const trackerFields = z.object({
  job_url: z.string().url().max(2000).refine(safeJobUrl, "Use an HTTP(S) job URL without credentials").transform(canonicalJobUrl).nullable().optional(),
  notes: z.string().max(10000).optional(),
  application_date: date.optional(), interview_date: date.optional(), follow_up_date: date.optional(), deadline_date: date.optional(),
  cv_id: z.string().uuid().nullable().optional(), company_report_id: z.string().uuid().nullable().optional(),
});
export const applicationSchema = z.object({
  company: z.string().trim().min(1, "Company is required.").max(200),
  role: z.string().trim().min(1, "Role is required.").max(200),
  status: z.enum(applicationStatuses).default("Applied"),
  job_text: z.string().trim().max(20000).default(""),
  job_analysis: jobSchema.optional(),
}).merge(trackerFields);
export const statusUpdateSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(applicationStatuses),
});
export const applicationUpdateSchema = applicationSchema.partial().extend({id:z.string().uuid(),status:z.enum(applicationStatuses).optional(),job_text:z.string().trim().max(20000).optional()});
export function filterApplications(rows: ApplicationRow[], query: string, status: string) {
  const q = query.trim().toLowerCase();
  return rows.filter(row => (!status || row.status === status) && `${row.company} ${row.role} ${row.notes || ""}`.toLowerCase().includes(q));
}
export type ApplicationRow = Database["public"]["Tables"]["applications"]["Row"];
export type TrackerFields = {job_url:string|null; notes:string; application_date:string|null; interview_date:string|null; follow_up_date:string|null; deadline_date?:string|null; cv_id:string|null; company_report_id:string|null};

// Changing source text or the selected CV invalidates derived application material.
export function applicationChanges(input:Omit<z.infer<typeof applicationUpdateSchema>,"id">):Database["public"]["Tables"]["applications"]["Update"]{
 return {...input,...("job_text" in input?{job_analysis:null,match_score:null,match_result:null,agent_result:null}:"cv_id" in input?{match_score:null,match_result:null,agent_result:null}:{})};
}
