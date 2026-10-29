import {z} from "zod";
import {jobSkills,skillsIn} from "../hybrid-jobs";
export const suggestionSchema=z.object({original_quote:z.string().min(15).max(2000),suggested_text:z.string().min(15).max(2000),reason:z.string().max(500)}).strict();
export const tailoringOutput=z.object({suggestions:z.array(suggestionSchema).max(8),section_order:z.array(z.enum(["Contact Information","Professional Summary","Education","Technical Skills","Projects","Experience","Certifications","Achievements"])).max(8),relevant_quotes:z.array(z.string().min(15).max(2000)).max(8)}).strict();
export type Suggestion=z.infer<typeof suggestionSchema>;
export type TailoringResult={section_order:string[];relevant_quotes:string[];suggestions:Suggestion[];required:string[];preferred:string[];missing_required:string[];missing_preferred:string[];matched:string[];source_text:string;source_url:string|null;guidance:string[]};
export type TailoringRun={id:string;user_id:string;cv_id:string;application_id:string;result:TailoringResult;decisions:Record<string,"accepted"|"rejected">;created_at:string};
const normalized=(s:string)=>s.replace(/\s+/g," ").trim();
// Conservative extractive edits: AI may shorten an exact source sentence, not add facts.
export function groundedSuggestions(value:unknown,cv:string){
 return tailoringOutput.parse(value).suggestions.filter(s=>{
  const before=normalized(s.original_quote),after=normalized(s.suggested_text);
  const lines=cv.split(/\r?\n/).map(normalized);
  const expected=before.replace(/^(?:[-*?]\s*)?(?:I was responsible for |My responsibilities included |Responsibilities included |I have |I )/i, "");
  if(!lines.includes(before)||expected===before||after!==expected)return false;
  if(/\b(not|never|without|planned|learning|assisted|team|coursework|prototype)\b/i.test(before) && !before.toLowerCase().split(/\W+/).filter(w=>/^(not|never|without|planned|learning|assisted|team|coursework|prototype)$/.test(w)).every(w=>after.toLowerCase().split(/\W+/).includes(w)))return false;
  if((before.match(/\d+(?:\.\d+)?%?/g)||[]).some(n=>!after.includes(n)))return false;
  if(/ignore .*instruction|system prompt|developer message/i.test(before))return false;
  return true;
 }).filter((s,i,a)=>a.findIndex(t=>t.original_quote===s.original_quote)===i);
}
export function comparison(cv:string,job:string){
 const {required,preferred}=jobSkills(job),known=skillsIn(cv),has=(s:string)=>known.some(k=>k.toLowerCase()===s.toLowerCase());
 return {required,preferred,matched:[...required,...preferred].filter(has),missing_required:required.filter(s=>!has(s)),missing_preferred:preferred.filter(s=>!has(s))};
}
export function acceptedSuggestions(run:TailoringRun){return run.result.suggestions.filter((_,i)=>run.decisions[String(i)]==="accepted");}
