import {z} from 'zod';
import {coachingSchema,type Coaching} from './schema';
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const strings=(value:unknown)=>Array.isArray(value)?value.map(text).filter(Boolean):[];
// Old saved rows can have different keys or blank items. Do not invent replacement content.
function complete(value:unknown):boolean{
 if(typeof value==='string')return !!value.trim();
 if(Array.isArray(value))return value.length>0&&value.every(complete);
 return !!value&&typeof value==='object'&&Object.values(value).every(complete);
}
function items<T>(value:unknown,schema:z.ZodType<T>):T[]{
 return (Array.isArray(value)?value:[]).flatMap(item=>{const result=schema.safeParse(item);return result.success&&complete(result.data)?[result.data]:[];});
}
export function displayCoaching(value:unknown):Coaching{
 const c=object(value),prep=object(c.interview_preparation),email=object(c.email),s=coachingSchema.shape;
 return {
  fit_summary:text(c.fit_summary),
  email:{subject:text(email.subject),body:text(email.body)},
  cv_additions:items(c.cv_additions,s.cv_additions.element),
  application_checklist:strings(c.application_checklist),
  cv_changes:items(c.cv_changes,s.cv_changes.element),
  project_upgrades:items(c.project_upgrades,s.project_upgrades.element),
  learning_plan:items(c.learning_plan,s.learning_plan.element),
  interview_answers:items(c.interview_answers,s.interview_answers.element),
  similar_company_leads:items(c.similar_company_leads,s.similar_company_leads.element),
  interview_preparation:{introduction_outline:strings(prep.introduction_outline),questions_to_ask:strings(prep.questions_to_ask),practice_questions:items(prep.practice_questions,s.interview_preparation.shape.practice_questions.element)},
 };
}
