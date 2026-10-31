import {z} from 'zod';
import {aiFeedbackSchema} from './schema';
export function cvEvidenceCatalog(text:string){
 const entries:{id:string;text:string}[]=[];
 for(const line of text.split(/\r?\n/)){
  if(/\[(?:contact details|link) omitted\]/i.test(line))continue;
  for(let start=0;start<line.length;start+=600){
   const quote=line.slice(start,start+600).trim();
   if(quote.length>=4)entries.push({id:`CVE${String(entries.length+1).padStart(4,'0')}`,text:quote});
   if(entries.length===200)return entries;
  }
 }
 return entries;
}
export function catalogFeedbackSchema(entries:ReturnType<typeof cvEvidenceCatalog>){
 if(!entries.length)throw new Error('No usable CV evidence');
 const id=z.enum(entries.map(entry=>entry.id) as [string,...string[]]);
 return aiFeedbackSchema.extend({
  relevance:aiFeedbackSchema.shape.relevance.extend({evidence:id}),
  writing:aiFeedbackSchema.shape.writing.extend({evidence:id}),
  feedback:z.array(aiFeedbackSchema.shape.feedback.element.extend({evidence:id,before:z.union([id,z.literal('')])})).max(8),
 });
}
export function restoreCatalogEvidence(raw:unknown,entries:ReturnType<typeof cvEvidenceCatalog>){
 const result=catalogFeedbackSchema(entries).parse(raw);
 const quotes=new Map(entries.map(entry=>[entry.id,entry.text]));
 return {...result,relevance:{...result.relevance,evidence:quotes.get(result.relevance.evidence)!},writing:{...result.writing,evidence:quotes.get(result.writing.evidence)!},feedback:result.feedback.map(item=>({...item,evidence:quotes.get(item.evidence)!,before:item.before?quotes.get(item.before)!:''}))};
}
