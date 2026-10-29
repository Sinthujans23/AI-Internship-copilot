import { z } from "zod";

export const resources={
 mdn:{title:"MDN: Learn web development",url:"https://developer.mozilla.org/en-US/docs/Learn_web_development",skills:["HTML","CSS","JavaScript"]},
 react:{title:"React: Learn",url:"https://react.dev/learn",skills:["React"]},
 python:{title:"Python tutorial (assumes basic programming)",url:"https://docs.python.org/3/tutorial/",skills:["Python"]},
 typescript:{title:"TypeScript handbook",url:"https://www.typescriptlang.org/docs/handbook/intro.html",skills:["TypeScript"]},
 fastapi:{title:"FastAPI tutorial",url:"https://fastapi.tiangolo.com/tutorial/",skills:["FastAPI"]},
 postgres:{title:"PostgreSQL and SQL tutorial",url:"https://www.postgresql.org/docs/current/tutorial.html",skills:["SQL","PostgreSQL"]},
 git:{title:"Git tutorial",url:"https://git-scm.com/docs/gittutorial",skills:["Git"]},
} as const;
export const resourceId=z.enum(["mdn","react","python","typescript","fastapi","postgres","git"]);
export const learningInputSchema=z.object({target_role:z.string().trim().min(2).max(120),weeks:z.number().int().min(1).max(12),weekly_hours:z.number().int().min(1).max(20),source_key:z.string().max(600).nullable()});
export type LearningInput=z.infer<typeof learningInputSchema>;
export const taskDefinitionSchema=z.object({title:z.string().min(5).max(160),topic:z.string().min(2).max(150),kind:z.enum(["Practice","Mini-project"]),minutes:z.number().int().min(15).max(1020),deliverable:z.string().min(10).max(600),checks:z.array(z.string().min(5).max(250)).min(2).max(4),resource_ids:z.array(resourceId).max(3)}).strict();
export type TaskDefinition=z.infer<typeof taskDefinitionSchema>;
export const roadmapSchema=z.object({summary:z.string().min(10).max(700),weeks:z.array(z.object({week:z.number().int().min(1).max(12),milestone:z.string().min(5).max(180),tasks:z.array(taskDefinitionSchema).min(1).max(3)}).strict()).min(1).max(12)}).strict();
export type Roadmap=z.infer<typeof roadmapSchema>;
export const statusSchema=z.enum(["Not Started","In Progress","Completed"]);
export const evidenceUrlSchema=z.string().trim().max(2000).url().refine(value=>{const url=new URL(value);return url.protocol==="https:"&&!url.username&&!url.password;},"Use an HTTPS project link without credentials.").nullable();
export const taskUpdateSchema=z.object({id:z.string().uuid(),status:statusSchema,notes:z.string().max(1500),evidence_url:evidenceUrlSchema,expected_updated_at:z.string().datetime({offset:true})});
export type LearningTask={id:string;roadmap_id:string;user_id:string;week:number;milestone:string;details:TaskDefinition;status:z.infer<typeof statusSchema>;notes:string;evidence_url:string|null;updated_at:string};
export type GapSource={key:string;label:string;required:string[];preferred:string[];other:string[];created_at:string;url:string|null};
export type LearningContext={cv_id:string;cv_name:string;current_skills:string[];approved_skills:string[];repository_skills:string[];source:GapSource|null;warnings:string[]};
export type SavedRoadmap={id:string;user_id:string;cv_id:string|null;target_role:string;weeks:number;weekly_hours:number;summary:string;context:LearningContext;mode:"AI"|"deterministic";parent_id:string|null;created_at:string};
export const adviceSchema=z.object({next_steps:z.array(z.object({task_id:z.string().uuid(),action:z.enum(["Start next","Continue practice","Review evidence","Follow-up practice"]),suggestion:z.string().min(10).max(400),completion_check:z.string().min(10).max(250),minutes:z.number().int().min(15).max(120)}).strict()).min(1).max(3)}).strict();
export type Advice=z.infer<typeof adviceSchema>;
