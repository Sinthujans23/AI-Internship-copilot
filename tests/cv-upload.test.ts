import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { prepareCvFile, saveCvVersion } from "../src/lib/cv-upload";
import { samplePdf } from "./fixtures/pdf";

test("real PDF upload extracts skills; fake, empty, oversized and scanned PDFs fail safely", async () => {
  const file = new File([new Uint8Array(samplePdf())], "cv.pdf", { type: "application/pdf" });
  const prepared = await prepareCvFile(file);
  assert.ok(prepared.skills.includes("Python"));
  assert.match(prepared.text, /education/);
  for (const invalid of [null, new File(["bad"], "bad.pdf", { type: "application/pdf" }), new File([new Uint8Array(4 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" }), new File([new Uint8Array(samplePdf(""))], "blank.pdf", { type: "application/pdf" })]) {
    await assert.rejects(prepareCvFile(invalid));
  }
});
test("saving a new PDF version preserves old data and has no carried-over review", async () => {
  const operations: string[] = [];
  let inserted: Record<string, unknown> = {};
  const client = { storage: { from() { return { async upload(path: string) { operations.push(path); return { error: null }; }, async remove() { assert.fail("old file must not be deleted"); } }; } }, from() { return { insert(value: Record<string, unknown>) { inserted = value; return this; }, select() { return this; }, async single() { return { data: inserted, error: null }; } }; } } as unknown as SupabaseClient<Database>;
  await saveCvVersion(client, "owner", { buffer: Buffer.from("pdf"), text: "fresh text", skills: ["Python"], name: "edited.pdf" }, {parent_cv_id:"source-cv",target_application_id:"target-job",tailoring_id:"review-session",accepted_suggestions:[{suggested_text:"Existing evidence"}]});
  assert.equal(operations.length, 1); assert.ok(operations[0].startsWith("owner/"));
  assert.equal(inserted.user_id, "owner");
  assert.equal(inserted.parent_cv_id,"source-cv"); assert.equal(inserted.target_application_id,"target-job"); assert.equal(inserted.tailoring_id,"review-session");
  assert.equal("cv_review_v2" in (inserted.analysis as object), false);
});
test("failed database insert cleans up only the newly uploaded file", async () => {
  let uploaded = ""; let removed: string[] = [];
  const client = { storage: { from() { return { async upload(path: string) { uploaded = path; return { error: null }; }, async remove(paths: string[]) { removed = paths; } }; } }, from() { return { insert() { return this; }, select() { return this; }, async single() { return { data: null, error: new Error("database down") }; } }; } } as unknown as SupabaseClient<Database>;
  await assert.rejects(saveCvVersion(client, "owner", { buffer: Buffer.from("pdf"), text: "fresh text", skills: [], name: "cv.pdf" }), /database down/);
  assert.deepEqual(removed, [uploaded]);
});
