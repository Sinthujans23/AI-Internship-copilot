// Return safe database codes, never raw details that can contain private CV data.
export function companySaveError(code?:string) {
  const reference=code && /^[A-Z0-9]{5,12}$/.test(code)?` (${code})`:'';
  if(code==='42501')return `Report storage permission denied${reference}. Run supabase/migrations/20261027050000_company_research.sql in Supabase SQL Editor, then sign in again.`;
  if(['42P01','42703','PGRST204','PGRST205'].includes(code||''))return `Company report storage schema is missing or outdated${reference}. Check supabase/migrations/20261027050000_company_research.sql in your connected Supabase project.`;
  if(code==='23503')return `The CV or account linked to this report no longer exists${reference}. Refresh CV Profile, select an available CV, then retry.`;
  if(code==='23505')return `A report with this identifier already exists${reference}. Refresh the shortlist to check saved reports.`;
  return `The report was generated but could not be saved${reference}. Share this error code so the database issue can be diagnosed. Do not share API keys or CV contents.`;
}
