import test from 'node:test';
import assert from 'node:assert/strict';
import {displayCoaching} from '../src/lib/company/display-coaching';
test('legacy and blank coaching entries do not become empty cards or bullets',()=>{
 const clean=displayCoaching({learning_plan:[{topic:'Legacy topic'},{}],interview_answers:[{question:' ',project_quote:' ',suggested_answer:' ',follow_up:' '}],similar_company_leads:['Example',{name:''}],interview_preparation:{introduction_outline:['',' ',null],questions_to_ask:[''],practice_questions:[{}]},project_upgrades:[{project_quote:'Built a project',suggested_feature:'Add tests',why_for_company:'Practice quality',implementation_steps:['']}]});
 assert.deepEqual(clean.learning_plan,[]);assert.deepEqual(clean.interview_answers,[]);assert.deepEqual(clean.project_upgrades,[]);assert.deepEqual(clean.similar_company_leads,[]);
 assert.deepEqual(clean.interview_preparation,{introduction_outline:[],practice_questions:[],questions_to_ask:[]});
});
test('valid suggestions are preserved while incomplete ones are excluded without mutating history',()=>{
 const valid={skill:'React',priority:'High',reason:'Practice frontend',practice_task:'Build a form',course_topic:'Forms'};
 const raw={learning_plan:[valid,{...valid,skill:''}],application_checklist:[' ', 'Verify the vacancy'],email:{subject:'Apply',body:'Dear Hiring Manager'},interview_preparation:{introduction_outline:['Explain your actual project'],questions_to_ask:['How is mentoring structured?'],practice_questions:[]}};
 const before=JSON.stringify(raw),clean=displayCoaching(raw);
 assert.deepEqual(clean.learning_plan,[valid]);assert.deepEqual(clean.application_checklist,['Verify the vacancy']);assert.equal(clean.email.subject,'Apply');assert.equal(JSON.stringify(raw),before);
});
test('missing or malformed saved coaching stays explicitly empty, never fabricated',()=>{
 for(const value of [undefined,null,[],{email:null}]){
  const clean=displayCoaching(value);assert.equal(clean.email.body,'');assert.deepEqual(clean.cv_changes,[]);assert.deepEqual(clean.similar_company_leads,[]);
 }
});
