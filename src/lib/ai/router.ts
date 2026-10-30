// Routing is code, not another paid LLM call. Each entry is one compatible stage.
export const aiStages = {
  job_details: ['job extraction'],
  application_content: ['CV bullets', 'email draft'],
  employer_evidence: ['required/preferred skills', 'company facts', 'application instructions'],
  company_career_coaching: ['CV suggestions', 'learning priorities', 'interview preparation', 'email draft'],
  cv_analyzer_v2: ['CV criteria', 'strengths', 'recommendations', 'before/after suggestions'],
  github_project_intelligence: ['project purpose', 'documented functionality', 'project improvements'],
  adaptive_learning_roadmap: ['weekly milestones', 'tasks', 'completion criteria', 'resources'],
  learning_next_steps: ['progress review', 'next actions'],
  truthful_cv_tailoring: ['section order', 'relevant experience', 'bullet suggestions'],
} as const;
export const localStages = ['company_retrieval', 'cv_context', 'embedding_match'] as const;
export type LocalStage = typeof localStages[number];
export function routeStage(name:string) {
  if(Object.prototype.hasOwnProperty.call(aiStages,name))return {mode:'llm' as const,calls:1,outputs:aiStages[name as keyof typeof aiStages]};
  if(localStages.includes(name as LocalStage))return {mode:'local' as const,calls:0,outputs:[name]};
  throw new Error('Unregistered AI workflow stage');
}
export async function runLocalStage<T>(name:LocalStage,execute:()=>Promise<T>):Promise<T>{
  if(routeStage(name).mode!=='local')throw new Error('Expected a local workflow stage');
  return execute();
}
