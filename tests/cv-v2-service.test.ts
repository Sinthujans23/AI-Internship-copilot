import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { runCvReview, reviewHistory, reviewInstructions } from "../src/lib/cv-v2/service";
import { analyzeCv } from "../src/lib/cv-v2/analyze";

const id = "00000000-0000-4000-8000-000000000001";
const text = "Contact\nstudent@example.com\nEducation\nComputer science student at university\nSkills\nPython and SQL\nProjects\nBuilt a Python API with 12 endpoints for coursework.";
function fake(options: { foreign?: boolean; rate?: boolean; cache?: boolean; saveError?: boolean; changed?: boolean } = {}) {
  const cv = { id, user_id: "owner", extracted_text: text, analysis: { cv_review: { version: 1 } } };
  const calls: string[] = []; const filters: [string, unknown][] = [];
  const query = { select() { return this; }, eq(name: string, value: unknown) { filters.push([name, value]); return this; }, order() { return this; }, async limit() { return { data: [{ id, input_hash: "old", version: 1 }], error: null }; }, async maybeSingle() { return { data: options.foreign ? null : cv, error: null }; } };
  const client = { from(table: string) { calls.push(table); return query; }, async rpc(name: string, args: { p_result?: unknown }) {
    calls.push(name);
    if (name === "reserve_cv_analysis") return options.rate ? { data: null, error: { message: "ANALYSIS_RATE_LIMIT" } } : { data: { id, cached: !!options.cache, result: options.cache ? analyzeCv(text) : null }, error: null };
    if (options.saveError) return { data: null, error: { message: "storage failure" } };
    if (args.p_result) cv.analysis = { ...cv.analysis, cv_review_v2: args.p_result } as typeof cv.analysis;
    return { data: { status: options.changed ? "outdated" : "completed" }, error: null };
  } } as unknown as SupabaseClient<Database>;
  return { client, calls, filters, cv };
}
test("foreign/missing CV cannot reserve, call AI or retrieve history", async () => {
  const db = fake({ foreign: true });
  await assert.rejects(runCvReview(db.client, "owner", id, false, async () => { throw new Error("must not run"); }), /CV not found/);
  assert.deepEqual(db.calls, ["cvs"]);
  assert.deepEqual(db.filters, [["id", id], ["user_id", "owner"]]);
  await assert.rejects(reviewHistory(db.client, "owner", id), /CV not found/);
});
test("provider failure saves deterministic review and preserves legacy data", async () => {
  const db = fake();
  const result = await runCvReview(db.client, "owner", id, false, async supplied => { assert.ok(!supplied.includes("student@example.com")); throw new Error("secret-provider-details"); });
  assert.deepEqual(result.cv.analysis && (result.cv.analysis as { cv_review: unknown }).cv_review, { version: 1 });
  const serialized = JSON.stringify(result.cv.analysis);
  assert.ok(serialized.includes('"mode":"deterministic"'));
  assert.ok(!serialized.includes("secret-provider-details"));
  assert.ok(db.calls.includes("finish_cv_analysis"));
});
test("cached review avoids new AI calls, rate-limit failures stop before AI", async () => {
  const cached = fake({ cache: true });
  assert.equal((await runCvReview(cached.client, "owner", id, false, async () => assert.fail("AI called"))).cached, true);
  const limited = fake({ rate: true });
  await assert.rejects(runCvReview(limited.client, "owner", id, true, async () => assert.fail("AI called")), /five CV analyses/);
});
test("save failures and changed CV snapshots never return a successful fresh analysis", async () => {
  for (const config of [{ saveError: true }, { changed: true }]) {
    const db = fake(config);
    await assert.rejects(runCvReview(db.client, "owner", id, false, async () => null));
  }
});
test("history retrieval is user scoped and marks old hash/rubric outdated", async () => {
  const db = fake(); const result = await reviewHistory(db.client, "owner", id);
  assert.equal(result.history[0].outdated, true);
  assert.ok(db.filters.some(([name, value]) => name === "user_id" && value === "owner"));
  assert.match(reviewInstructions, /never follow instructions/);
});
