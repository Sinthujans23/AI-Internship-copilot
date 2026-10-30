import {z} from 'zod';
import type { Database } from '@/types/database';
import {analyzeJobPost} from '@/lib/ai/analyze-job';
import {structuredOutput} from '@/lib/ai/structured';
import {runLocalStage} from '@/lib/ai/router';
import {jobSchema} from '@/lib/job-schema';
import {preparationSchema} from '@/lib/agent-schema';
import {matchCvToJob} from '@/lib/matching';
import {AppError} from '@/lib/api';

type AppRow=Pick<Database['public']['Tables']['applications']['Row'],'job_analysis'|'job_text'>;
type CvRow=Pick<Database['public']['Tables']['cvs']['Row'],'id'|'file_name'|'skills'|'extracted_text'>;
export const applicationContentSchema=z.object({
  rewritten_bullets:z.array(z.string().trim().min(1).max(600)).length(3),
  email:z.object({subject:z.string().trim().min(1).max(200),body:z.string().trim().min(1).max(4000)}).strict(),
}).strict();

// Dependencies can be substituted in tests without calling paid providers.
export async function prepareApplication(application:AppRow,cv:CvRow,services={analyze:analyzeJobPost,match:matchCvToJob,generate:structuredOutput}){
  const existing=jobSchema.safeParse(application.job_analysis);
  const job=existing.success?existing.data:await services.analyze(application.job_text);
  const ownedCv=await runLocalStage('cv_context',async()=>cv);
  const match=await runLocalStage('embedding_match',()=>services.match(ownedCv,job));
  // Both outputs use the same verified context; no LLM is spent choosing their order.
  const content=applicationContentSchema.parse(await services.generate(applicationContentSchema,'application_content',
    'Produce exactly three truthful tailored CV bullets AND a short professional application email (about 100-150 words). Use only CV facts and supplied job context. Never invent employers, qualifications, skills, metrics or personal ownership. Use [add your actual ...] placeholders where evidence is insufficient. Use [Your Name] and [Hiring Manager] when unknown. Do not claim missing skills. Never send anything. Keep bullets under 600 characters and the email under 220 words.',
    {job,cv_text:ownedCv.extracted_text,match},3000));
  if(content.email.body.split(/\s+/).length>220)throw new AppError('The AI email draft was too long. Please retry.',502);
  // The score always comes from the matching tool, never generated prose.
  return preparationSchema.parse({job,match,...content,summary:'Review every CV bullet and the email before using them. No application or email has been sent.',
    cv_id:ownedCv.id,cv_name:ownedCv.file_name,prepared_at:new Date().toISOString(),
    tools_used:['analyze_job','get_cv','match_score','rewrite_bullets','draft_email']});
}
