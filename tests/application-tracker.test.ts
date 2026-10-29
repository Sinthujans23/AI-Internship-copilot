import test from "node:test";
import assert from "node:assert/strict";
import {applicationSchema,applicationUpdateSchema,canonicalJobUrl,filterApplications,type ApplicationRow,applicationStatuses} from "../src/lib/applications";
test("tracker keeps legacy create/status payloads and supports seven stages",()=>{
 assert.equal(applicationSchema.parse({company:"Example",role:"Intern"}).status,"Applied");
 for(const status of applicationStatuses)assert.equal(applicationUpdateSchema.parse({id:"10000000-0000-4000-8000-000000000001",status}).status,status);
 assert.equal(applicationUpdateSchema.parse({id:"10000000-0000-4000-8000-000000000001",notes:"updated"}).status,undefined);
});
test("tracker validates edits and strips owner input",()=>{
 assert.equal(applicationSchema.safeParse({company:"",role:"Intern"}).success,false);
 assert.equal(applicationSchema.safeParse({company:"Example",role:"Intern",job_url:"javascript:alert(1)"}).success,false);
 assert.equal(applicationSchema.safeParse({company:"Example",role:"Intern",interview_date:"2026-02-31"}).success,false);
 assert.equal(applicationSchema.safeParse({company:"Example",role:"Intern",notes:"x".repeat(10001)}).success,false);
 for(const job_url of ["https://?", "https://user:secret@example.com/job"]) assert.equal(applicationSchema.safeParse({company:"Example",role:"Intern",job_url}).success,false);
 assert.equal("user_id" in applicationSchema.parse({company:"Example",role:"Intern",user_id:"attacker"}),false);
});
test("dedup URL drops tracking, keeps vacancy identifiers",()=>{
 assert.equal(canonicalJobUrl("https://example.com/jobs?id=42&utm_source=feed#apply"),"https://example.com/jobs?id=42");
 assert.notEqual(canonicalJobUrl("https://example.com/jobs?id=42"),canonicalJobUrl("https://example.com/jobs?id=43"));
});
test("tracker filters company, title, notes and stages without mutating records",()=>{
 const rows=[{company:"Example",role:"Intern",notes:"Call recruiter",status:"Saved"},{company:"Other",role:"Engineer",notes:"",status:"Interview"}] as ApplicationRow[];
 assert.equal(filterApplications(rows," RECRUITER ","").length,1);
 assert.equal(filterApplications(rows,"engineer","Interview").length,1);
 assert.equal(filterApplications(rows,"Example","Rejected").length,0);
 assert.equal(filterApplications(rows,"","").length,2);
});
