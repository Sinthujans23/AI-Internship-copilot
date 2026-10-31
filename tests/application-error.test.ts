import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applicationDatabaseError} from '../src/lib/application-error';

test('application schema failures identify the tracker migration',()=>{
 for(const code of ['42703','42P01','PGRST204','PGRST205']){
  const result=applicationDatabaseError({code});
  assert.equal(result.status,503);
  assert.match(result.message,/20261029000000_application_tracker.sql/);
 }
});
test('application permission, duplicate and linked ownership failures stay distinct',()=>{
 assert.equal(applicationDatabaseError({code:'42501'}).status,403);
 assert.match(applicationDatabaseError({code:'23505'}).message,/already saved/);
 assert.match(applicationDatabaseError({code:'P0001',message:'CV_NOT_FOUND'}).message,/linked CV/);
 assert.match(applicationDatabaseError({code:'23503'}).message,/linked CV/);
 assert.match(applicationDatabaseError({code:'23514'}).message,/constraint/);
});
test('application diagnostics never expose raw database messages or unsafe codes',()=>{
 const result=applicationDatabaseError({code:'private-value!',message:'secret CV and SQL details'});
 assert.doesNotMatch(result.message,/secret|private-value|SQL details/);
 assert.doesNotMatch(applicationDatabaseError({code:'P0001',message:'private CV'}).message,/private CV/);
});
