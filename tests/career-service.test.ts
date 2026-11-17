import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { careerContext, startInterview, scoreInterview, generateDrafts } from "../src/lib/career/service";
import type { paidOperation } from "../src/lib/security/paid-operation";
type Query = { table: string; filters: [string, unknown][]; mode: string; payload?: unknown; single: boolean };
function mock(respond: (q: Query) => { data: unknown; error?: unknown }) {
  const queries: Query[] = [];
  const db = { from(table: string) {
    const req: Query = { table, filters: [], mode: "read", single: false }; queries.push(req);
    const q = { select() { return q; }, eq(k: string, v: unknown) { req.filters.push([k, v]); return q; }, is(k: string, v: unknown) { req.filters.push([k, v]); return q; }, limit() { return q; },
      insert(payload: unknown) { req.mode = "insert"; req.payload = payload; return q; }, update(payload: unknown) { req.mode = "update"; req.payload = payload; return q; },
      single() { req.single = true; return q; }, maybeSingle() { req.single = true; return q; },
      then(resolve: (r: unknown) => unknown) { return Promise.resolve({ error: null, ...respond(req) }).then(resolve); } }; return q;
  } } as unknown as SupabaseClient<Database>;
  return { db, queries };
}
const cv = { id: "cv", file_name: "CV.pdf", extracted_text: "Built a coursework API" };
const job = { id: "job", company: "Company", role: "Intern", job_text: "Python internship" };
const questions = Array.from({ length: 5 }, (_, i) => ({ question: `Question ${i}`, focus: "Project" }));
const feedback = Array(5).fill({ relevance: 3, specificity: 4, clarity: 5, strengths: "Concrete", improvement: "Add context", suggested_outline: "Context and outcome" });
const paid: typeof paidOperation = async (_db, _kind, _input, work) => work();

test("career context denies foreign/missing records before any generation and scopes both inputs", async () => {
  const { db, queries } = mock(q => ({ data: q.table === "cvs" ? cv : null }));
  await assert.rejects(() => careerContext(db, "owner", "cv", "foreign"), /not found/);
  assert.ok(queries.every(q => q.filters.some(([k, v]) => k === "user_id" && v === "owner")));
});
test("missing career migration stops paid work before invoking a provider", async () => {
  let generated = false;
  const { db } = mock(q => q.table === "cvs" ? { data: cv } : q.table === "applications" ? { data: job } : { data: null, error: {} });
  await assert.rejects(() => startInterview(db, "owner", "cv", "job", "request", { paid, generate: async <T>(schema: z.ZodType<T>) => { generated = true; return schema.parse({ questions }); } }), /migration/);
  assert.equal(generated, false);
});
test("interview generation saves source snapshots and the owner, and separates new practice requests", async () => {
  let input: unknown;
  const { db, queries } = mock(q => q.table === "cvs" ? { data: cv } : q.table === "applications" ? { data: job } : q.mode === "insert" ? { data: { id: "session", ...q.payload as object } } : { data: [] });
  const deps = { paid: (async (client, kind, context, work) => { input = context; return paid(client, kind, context, work); }) as typeof paidOperation,
    generate: async <T>(schema: z.ZodType<T>) => schema.parse({ questions }) };
  const row = await startInterview(db, "owner", "cv", "job", "new-practice", deps);
  assert.equal(row.user_id, "owner"); assert.equal(row.context.cv_text, cv.extracted_text);
  assert.equal((input as { requestId: string }).requestId, "new-practice");
  assert.ok(queries.filter(q => q.mode === "read").every(q => q.filters.some(([k, v]) => k === "user_id" && v === "owner")));
});
test("scored sessions cannot be overwritten or trigger another billable assessment", async () => {
  let called = false;
  const { db } = mock(() => ({ data: { id: "session", feedback } }));
  await assert.rejects(() => scoreInterview(db, "owner", "session", Array(5).fill("answer"), { paid, generate: async <T>(schema: z.ZodType<T>) => { called = true; return schema.parse({ feedback }); } }), /already scored/);
  assert.equal(called, false);
});
test("answer assessment calculates the score and uses a conditional owner-scoped write", async () => {
  const snapshot = { id: "session", context: { ...cv, ...job }, questions, feedback: null };
  const { db, queries } = mock(q => ({ data: q.mode === "update" ? { ...snapshot, ...q.payload as object } : snapshot }));
  const result = await scoreInterview(db, "owner", "session", Array(5).fill("answer"), { paid, generate: async <T>(schema: z.ZodType<T>) => schema.parse({ feedback }) });
  assert.equal(result.score, 80); const update = queries.find(q => q.mode === "update")!;
  assert.ok(update.filters.some(([k, v]) => k === "user_id" && v === "owner"));
  assert.ok(update.filters.some(([k, v]) => k === "feedback" && v === null));
});
test("a concurrent interview completion is reported as a conflict rather than fabricated success", async () => {
  const { db } = mock(q => ({ data: q.mode === "update" ? null : { id: "session", context: {}, questions, feedback: null } }));
  await assert.rejects(() => scoreInterview(db, "owner", "session", Array(5).fill("answer"), { paid, generate: async <T>(schema: z.ZodType<T>) => schema.parse({ feedback }) }), /already completed/);
});
test("cached draft generation loads current edits instead of restoring old AI content", async () => {
  const edited = { id: "pack", content: { cover_letter: "My edited version", application_email: "Email", follow_up: "Follow-up" } };
  const { db, queries } = mock(q => q.table === "cvs" ? { data: cv } : q.table === "applications" ? { data: job } : { data: q.single ? edited : [] });
  const cached = (async () => ({ id: "pack", content: { cover_letter: "Old generation" } })) as unknown as typeof paidOperation;
  const result = await generateDrafts(db, "owner", "cv", "job", { paid: cached, generate: async () => { throw new Error("Must not regenerate cache hit"); } });
  assert.equal(result.content.cover_letter, "My edited version");
  assert.ok(queries.filter(q => q.table === "draft_packs").every(q => q.filters.some(([k, v]) => k === "user_id" && v === "owner")));
});
