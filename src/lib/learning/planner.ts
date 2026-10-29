import { roadmapSchema,resources,adviceSchema,type LearningInput,type LearningContext,type Roadmap,type LearningTask,type TaskDefinition,type Advice } from "./schema";

export function taskSignature(t:TaskDefinition){return JSON.stringify([t.title,t.topic,t.deliverable,t.checks]).toLowerCase().replace(/\s+/g," ");}
export function validateRoadmap(value:unknown,input:LearningInput,completed:LearningTask[]=[]){
 const plan=roadmapSchema.parse(value),seen=new Set<string>(),old=new Set(completed.map(t=>taskSignature(t.details)));
 if(plan.weeks.length!==input.weeks)throw new Error("Roadmap duration mismatch");
 if(/https?:\/\/|www\.|\b(mastered|certified|guaranteed job)\b/i.test(JSON.stringify(plan)))throw new Error("Unsupported links or mastery claims");
 for(const [index,week] of plan.weeks.entries()){
  if(week.week!==index+1)throw new Error("Weeks must be consecutive");
  if(week.tasks.reduce((n,t)=>n+t.minutes,0)>Math.floor(input.weekly_hours*60*0.85))throw new Error("Weekly workload exceeds budget including buffer");
  for(const task of week.tasks){const key=taskSignature(task);if(seen.has(key)||old.has(key))throw new Error("Duplicate or already completed task");seen.add(key);}
 }
 if(!plan.weeks.some(w=>w.tasks.some(t=>t.kind==="Mini-project")))throw new Error("Include a mini-project");
 return plan;
}
export function fallbackRoadmap(input:LearningInput,context:LearningContext,completed:LearningTask[]=[]):Roadmap{
 const skills=[...new Set([...(context.source?.required||[]),...(context.source?.preferred||[]),...(context.source?.other||[]),...context.current_skills])].slice(0,12);
 const focus=skills.length?skills:[`${input.target_role} foundations`];
 const minutes=Math.floor(input.weekly_hours*60*0.75);
 const plan:Roadmap={summary:"A conservative practice plan is shown because AI planning was unavailable or invalid. Time estimates include review; keep the unused weekly time for difficulties. Completion is self-reported, not proof of mastery.",weeks:[]};
 for(let i=0;i<input.weeks;i++){
  const skill=focus[i%focus.length].slice(0,100),iteration=Math.max(0,...completed.map(t=>Number(t.details.title.match(/practice example (\d+)$/i)?.[1]||0)))+completed.length+i+1;
  const ids=Object.entries(resources).filter(([,r])=>(r.skills as readonly string[]).some(s=>s.toLowerCase()===skill.toLowerCase())).map(([id])=>id as keyof typeof resources).slice(0,2);
  plan.weeks.push({week:i+1,milestone:`Produce and explain one small ${skill} example`,tasks:[{title:`${skill}: practice example ${iteration}`,topic:skill,kind:"Mini-project",minutes,deliverable:`Create one narrowly scoped ${skill} example relevant to ${input.target_role}. Timebox reading and setup to one third of this task; simplify scope if needed.`,checks:["Save one runnable example or a reproducible worked example with instructions.","Record one successful case and one failure or limitation.","Write three sentences explaining your choices and remaining questions."],resource_ids:ids}]});
 }
 return validateRoadmap(plan,input,completed);
}
export function validateAdvice(value:unknown,tasks:LearningTask[],weeklyHours=20):Advice{
 const result=adviceSchema.parse(value);
 if(result.next_steps.reduce((n,s)=>n+s.minutes,0)>Math.floor(weeklyHours*60*0.85)||new Set(result.next_steps.map(s=>s.task_id)).size!==result.next_steps.length)throw new Error("Advice exceeds budget or repeats a task");
 if(/https?:\/\/|www\.|\b(mastered|certified|guaranteed job)\b/i.test(JSON.stringify(result)))throw new Error("Unsupported advice claims");
 for(const step of result.next_steps){
  const task=tasks.find(t=>t.id===step.task_id);if(!task)throw new Error("Advice references a foreign task");
  if(step.action==="Start next"&&task.status!=="Not Started")throw new Error("Progress mismatch");
  if(step.action==="Continue practice"&&task.status!=="In Progress")throw new Error("Progress mismatch");
  if(["Review evidence","Follow-up practice"].includes(step.action)&&task.status!=="Completed")throw new Error("Progress mismatch");
 }
 return result;
}
export function fallbackAdvice(tasks:LearningTask[],weeklyHours=20):Advice{
 const ordered=[...tasks].sort((a,b)=>({"In Progress":0,"Not Started":1,Completed:2}[a.status]-{"In Progress":0,"Not Started":1,Completed:2}[b.status])||a.week-b.week);
 const budget=Math.floor(weeklyHours*60*0.85),count=Math.min(3,Math.floor(budget/30));
 return {next_steps:ordered.slice(0,count).map(t=>({task_id:t.id,action:t.status==="Completed"?"Follow-up practice":t.status==="In Progress"?"Continue practice":"Start next",suggestion:t.status==="Completed"?`Try a different small example of ${t.details.topic} without copying your earlier solution. Record what still needs practice.`:`Work on ${t.details.title}. Reduce the scope if the time estimate is too tight.`,completion_check:t.status==="Completed"?"Save one new example and compare one successful and one failing case with your earlier work.":t.details.checks[0],minutes:Math.min(60,t.details.minutes,Math.floor(budget/count))}))};
}
