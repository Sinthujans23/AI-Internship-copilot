// Never expose database messages/details: they may contain private record values.
export function applicationDatabaseError(error: {code?:string; message?:string}) {
 const code=error.code;
 const reference=code&&/^[A-Z0-9]{5,12}$/.test(code)?` (${code})`:'';
 const migration='supabase/migrations/20261029000000_application_tracker.sql';
 if(code==='23505')return {status:409,message:'This job URL is already saved in your tracker.'};
 if(['42P01','42703','PGRST204','PGRST205'].includes(code||''))return {status:503,message:`Application storage schema is missing or outdated${reference}. Run ${migration} in the connected Supabase project SQL Editor, then retry. Earlier application, CV and company research migrations must already be installed.`};
 if(code==='42501')return {status:403,message:`Application storage permission denied${reference}. Check the applications and application_history RLS policies and grants. Sign in again; do not disable RLS.`};
 if(code==='23503'||(code==='P0001'&&['CV_NOT_FOUND','REPORT_NOT_FOUND'].includes(error.message||'')))return {status:409,message:`A linked CV or company report is unavailable${reference}. Refresh and choose an available record, or remove the optional link before saving.`};
 if(code==='23514')return {status:400,message:`An application value violates a database constraint${reference}. Check the entered values. If using Saved, Assessment or Withdrawn, ensure ${migration} has been applied.`};
 return {status:503,message:`Application storage request failed${reference}. Retry loading. If it persists, share this error code, not API keys or private data.`};
}
