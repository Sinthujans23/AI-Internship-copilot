import test from 'node:test';
import assert from 'node:assert/strict';
import {companySaveError} from '../src/lib/company/save-error';
test('report persistence errors distinguish permissions, schema and deleted CVs',()=>{
 assert.match(companySaveError('42501'),/permission denied/);
 assert.match(companySaveError('PGRST204'),/schema is missing or outdated/);
 assert.match(companySaveError('23503'),/CV or account/);
 assert.match(companySaveError('23505'),/already exists/);
});
test('unexpected database errors expose only a safe diagnostic code',()=>{
 assert.match(companySaveError('23502'),/23502/);
 assert.ok(!companySaveError('secret@example.com').includes('secret@example.com'));
 assert.match(companySaveError(),/could not be saved/);
});
