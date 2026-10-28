import { skillsIn, normalizeSkill } from "../hybrid-jobs";
import { improvements, projectAISchema, type Evidence, type Repository, type ProjectAnalysis } from "./schema";
import type { repositoryEvidence } from "./client";
type Input=Awaited<ReturnType<typeof repositoryEvidence>>;
const dependencies:Record<string,string>={react:"React",next:"Next.js",vue:"Vue",angular:"Angular","@angular/core":"Angular",express:"Express",typescript:"TypeScript",vite:"Vite",jest:"Jest",vitest:"Vitest",prisma:"Prisma",mongoose:"MongoDB",pg:"PostgreSQL",mysql2:"MySQL",redis:"Redis","@supabase/supabase-js":"Supabase",tailwindcss:"Tailwind CSS",fastapi:"FastAPI",django:"Django",flask:"Flask",pandas:"Pandas",numpy:"NumPy",torch:"PyTorch",tensorflow:"TensorFlow",pytest:"Pytest",sqlalchemy:"SQLAlchemy",requests:"Requests",axum:"Axum",tokio:"Tokio",serde:"Serde","github.com/gin-gonic/gin":"Gin","laravel/framework":"Laravel",rails:"Rails",flutter:"Flutter","spring-boot-starter":"Spring Boot"};
export function extractProjectSkills(input:Input):Evidence[]{
  const evidence:Evidence[]=Object.entries(input.languages).filter(([,bytes])=>bytes>0).slice(0,40).map(([skill,bytes])=>({skill,source:"GitHub languages API",quote:`${skill}: ${bytes} bytes`,kind:"language"}));
  for(const [name,text] of Object.entries(input.manifests)){
    if(name==="package.json"){
      try {const p=JSON.parse(text);for(const group of ["dependencies","devDependencies","peerDependencies"]){if(p[group] && typeof p[group]==="object")for(const key of Object.keys(p[group]))if(dependencies[key])evidence.push({skill:dependencies[key],source:name,quote:`${group}: ${key}`,kind:"dependency"});}}catch{/* Invalid JSON is not dependency evidence. */}
    }else if(name==="Dockerfile"){
      const from=text.split(/\r?\n/).find(line=>/^\s*FROM\s+\S+/i.test(line));
      if(from)evidence.push({skill:"Docker",source:name,quote:from.trim().slice(0,600),kind:"dependency"});
    }else{
      for(const line of text.split(/\r?\n/)){
        if(/^\s*(#|\/\/|<!--)/.test(line))continue;
        for(const [key,skill] of Object.entries(dependencies)){
          const escaped=key.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
          // Recognize dependency declarations, not arbitrary mentions in comments/descriptions.
          const declaration=new RegExp(`^\\s*(?:["']|gem\\s+["']|<artifactId>)?${escaped}(?:["']?\\s*[=<>~!:\\[]|\\s+v?\\d|["'],|</artifactId>|$)`,"i");
          if(declaration.test(line))evidence.push({skill,source:name,quote:line.trim().slice(0,600),kind:"dependency"});
        }
      }
    }
  }
  for(const line of input.readme.split(/\r?\n/))for(const skill of skillsIn(line))evidence.push({skill,source:"README",quote:line.slice(0,600),kind:"readme"});
  const seen=new Set<string>();return evidence.filter(e=>{const key=e.skill.toLowerCase()+e.source;if(seen.has(key))return false;seen.add(key);return true;}).slice(0,150);
}
export function analyzeProject(repo:Repository,input:Input,ai:unknown=null):ProjectAnalysis{
  const evidence=extractProjectSkills(input),source=`${repo.description||""}\n${input.readme}`;
  const parsed=projectAISchema.safeParse(ai),validQuote=(q:string)=>q.trim().length>=8 && source.includes(q);
  const purpose=parsed.success && validQuote(parsed.data.purpose_quote)?parsed.data.purpose_quote:repo.description||"Purpose not documented in available metadata.";
  const functionality=parsed.success?parsed.data.functionality_quotes.filter(validQuote):[];
  const selected=parsed.success?parsed.data.improvements:["contribution","setup","tests","architecture"] as const;
  const technologies=[...new Set(evidence.filter(e=>e.kind!=="readme").map(e=>e.skill))];
  return {version:1,repository:repo,analyzed_at:new Date().toISOString(),fetched_at:input.fetched_at,evidence,purpose,functionality,
    improvements:[...new Set(["contribution" as const,...selected])].map(key=>improvements[key]),mode:parsed.success?"AI-assisted":"deterministic",
    warnings:[...input.warnings,...(!parsed.success?["AI unavailable or invalid; showing deterministic repository evidence."]:[]),"Username entry does not verify account ownership. Repository evidence does not establish personal contribution or proficiency.",...(repo.fork?["Forked repository: inherited code is not evidence of your own implementation."]:[]),...(repo.archived?["This repository is archived."]:[])],
    cv_suggestion:`Project reference: ${repo.name} (https://github.com/${repo.full_name}). ${technologies.length?`Repository languages/dependencies include ${technologies.join(", ")}.`:"Review the available documentation."} Confirm and describe your own contribution before using this in your CV.`,
  };
}
export function compareSkills(analysis:ProjectAnalysis,cvSkills:string[],jobText=""){
  const key=(s:string)=>normalizeSkill(s).toLowerCase();const cv=new Set(cvSkills.map(key));
  const detected=[...new Set(analysis.evidence.map(e=>normalizeSkill(e.skill)))];
  const job=skillsIn(jobText);
  return {shared:detected.filter(s=>cv.has(key(s))),missing_from_cv:detected.filter(s=>!cv.has(key(s))),cv_without_repo_evidence:cvSkills.filter(s=>!detected.some(t=>key(t)===key(s))),job_shared:detected.filter(s=>job.some(t=>key(t)===key(s)))};
}

// Include technologies outside the original CV vocabulary (e.g. Jest or Redis)
// only when their literal name occurs in the actual uploaded text.
export function cvSkillsForProjects(text:string,stored:string[],analyses:ProjectAnalysis[]){
 const candidates=[...new Set(analyses.flatMap(a=>a.evidence.map(e=>e.skill)))];
 const additional=candidates.filter(skill=>{
  const escaped=skill.replace(/[.*+?^${}()|[\]\\]/g,"\\$&").replace(/\s+/g,"\\s+");
  return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`,"i").test(text);
 });
 return [...new Set([...stored,...skillsIn(text),...additional])];
}
