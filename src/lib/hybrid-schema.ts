import { z } from "zod";
const link = z.string().url().refine(value => {
  const url=new URL(value); return url.protocol==="https:" && !url.username && !url.password;
});
const skills=z.array(z.string().max(200)).max(100);
export const hybridResponseSchema=z.object({
  jobs:z.array(z.object({
    id:z.string(),title:z.string(),company:z.string(),location:z.string(),remote:z.boolean(),url:link,description:z.string().max(18000),source:z.string(),published:z.string().nullable(),skills,
    work_mode:z.enum(["Remote","Hybrid","On-site","Unknown"]),salary:z.object({min:z.number().finite().nonnegative(),max:z.number().finite().nonnegative(),currency:z.string(),period:z.string()}).nullable().optional(),
    application_url:link.nullable().optional(),fetched_at:z.string().optional(),expires_at:z.string().nullable().optional(),closed:z.boolean().optional(),
    preference_fit:z.enum(["match","unknown","mismatch"]).optional(),preference_checks:z.array(z.object({name:z.string(),status:z.enum(["match","unknown","mismatch"]),reason:z.string()})).optional(),
    score:z.number().int().min(0).max(100),matched_skills:skills,missing_required:skills,missing_preferred:skills,mentioned_skills:skills,required_skills:skills,preferred_skills:skills,
    components:z.array(z.object({name:z.string(),value:z.number().min(0).max(1).nullable(),weight:z.number().min(0).max(100)})),
    explanations:z.array(z.string()),semantic:z.number().min(0).max(1).nullable(),version:z.enum(["hybrid-1","hybrid-2"]),
  })).max(2000),warnings:z.array(z.string()),cv_name:z.string(),searched_at:z.string(),available_count:z.number().nonnegative(),version:z.enum(["hybrid-1","hybrid-2"]),
});
