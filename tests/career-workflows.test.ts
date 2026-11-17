import test from "node:test";
import assert from "node:assert/strict";
import { applicationReminders, remindersCalendar, calendarDay } from "../src/lib/career/reminders";
import { compareCvText } from "../src/lib/career/comparison";
import { personalizeJobs } from "../src/lib/career/feedback";
import { progressTrends, recurringGaps } from "../src/lib/career/progress";
import { interviewFeedbackSchema, interviewScore, questionsSchema, draftSchema, feedbackSchema } from "../src/lib/career/schema";
import type { HybridJob } from "../src/lib/hybrid-jobs";
import { loadCareerProgress } from "../src/lib/career/progress-service";
import type { Database } from "../src/types/database";
import type { SupabaseClient } from "@supabase/supabase-js";

test("reminders exclude terminal stages and applied deadlines, classify local days, and sort", () => {
  const base = { id: "one", company: "Example", role: "Intern", status: "Saved" as const, interview_date: "2026-11-13", follow_up_date: "2026-11-11", deadline_date: "2026-11-12" };
  const reminders = applicationReminders([base, { ...base, id: "closed", status: "Rejected" }, { ...base, id: "applied", status: "Applied", interview_date: null, follow_up_date: null }], "2026-11-12");
  assert.deepEqual(reminders.map(r => [r.kind, r.overdue]), [["Follow-up", true], ["Deadline", false], ["Interview", false]]);
  assert.equal(calendarDay(new Date("2026-11-11T20:00:00Z")), "2026-11-12");
  assert.equal(calendarDay(new Date("2026-11-11T20:00:00Z"), "America/New_York"), "2026-11-11");
});
test("calendar export escapes injected properties, folds UTF-8, uses stable IDs and exclusive end dates", () => {
  const input = [{ id: "a-Deadline", application_id: "a", date: "2026-12-31", title: "Test, team;\\name\nATTENDEE:bad@x " + "தமிழ்".repeat(25), kind: "Deadline" as const, overdue: false }];
  const ics = remindersCalendar(input, new Date("2026-11-12T00:00:00Z"));
  assert.match(ics, /DTSTART;VALUE=DATE:20261231/); assert.match(ics, /DTEND;VALUE=DATE:20270101/);
  assert.match(ics, /UID:a-Deadline@internship-copilot/); assert.ok(!ics.includes("\r\nATTENDEE:"));
  assert.ok(ics.split("\r\n").every(line => new TextEncoder().encode(line).length <= 75));
  const unfolded = ics.replace(/\r\n /g, ""); assert.ok(unfolded.includes("Test\\, team\\;\\\\name\\nATTENDEE:"));
});
test("CV diff handles repeated lines, trims layout whitespace, and bounds large inputs", () => {
  const diff = compareCvText("Education\nPython API\nEducation\n", " Education \r\nPython API with tests\nEducation");
  assert.equal(diff.added, 1); assert.equal(diff.removed, 1);
  assert.deepEqual(diff.lines.filter(l => l.kind === "same").map(l => l.text), ["Education", "Education"]);
  assert.equal(compareCvText("a\n".repeat(401), "a").truncated, true);
  assert.equal(compareCvText("", "New").added, 1);
});
test("feedback uses canonical URLs, preserves preference groups, clamps scores and is reversible", () => {
  const make = (id: string, score: number, fit: HybridJob["preference_fit"] = "match") => ({ id, url: `https://jobs.example/${id}?utm_source=x`, score, preference_fit: fit, explanations: ["Base evidence"] } as HybridJob);
  const jobs = [make("a", 98), make("b", 80), make("c", 100, "mismatch"), make("d", 2)];
  const feedback = [{ job_url: "https://jobs.example/a", verdict: "expired" as const }, { job_url: "https://jobs.example/b", verdict: "relevant" as const }, { job_url: "https://jobs.example/d", verdict: "not_relevant" as const }];
  const result = personalizeJobs(jobs, feedback);
  assert.deepEqual(result.map(j => j.id), ["b", "d", "c"]); assert.equal(result[0].score, 85); assert.equal(result[1].score, 0);
  assert.equal(jobs[1].score, 80); assert.equal(jobs[1].explanations.length, 1);
  assert.equal(personalizeJobs(jobs, [feedback[1]])[0].score, 98);
  assert.equal(personalizeJobs([jobs[0]], [{ job_url: "https://jobs.example/a", verdict: "relevant" }])[0].score, 100);
});
test("weekly cohort conversion retains rejected applicants who previously interviewed", () => {
  const rows = [
    { id: "a", application_date: "2026-11-12", status: "Rejected" as const },
    { id: "b", application_date: "2026-11-11", status: "Applied" as const },
    { id: "old", application_date: "2025-01-01", status: "Interview" as const },
    { id: "future", application_date: "2026-11-13", status: "Interview" as const },
    { id: "undated", application_date: null, status: "Interview" as const },
  ];
  const result = progressTrends(rows, [{ application_id: "a", old_status: "Interview", new_status: "Rejected" }], "2026-11-12");
  assert.equal(result.cohort, 2); assert.equal(result.conversion, 50); assert.equal(result.weeks.reduce((s, w) => s + w.count, 0), 2);
  assert.equal(result.weeks.length, 8); assert.equal(progressTrends([], [], "2026-11-12").conversion, null);
});
test("recurring gaps count unique listings and skill names rather than repeated snapshots", () => {
  assert.deepEqual(recurringGaps([{ id: "a", required: ["Python", "python", "SQL"] }, { id: "a", required: ["Python"] }, { id: "b", required: ["PYTHON"] }]), [{ skill: "python", count: 2 }, { skill: "sql", count: 1 }]);
});
test("interview schemas reject partial or out-of-range scoring and score the rubric deterministically", () => {
  const row = { relevance: 5, specificity: 3, clarity: 4, strengths: "Specific example", improvement: "Explain your decision", suggested_outline: "Problem, action, result" };
  const valid = interviewFeedbackSchema.parse({ feedback: Array(5).fill(row) }); assert.equal(interviewScore(valid.feedback), 80);
  assert.equal(interviewFeedbackSchema.safeParse({ feedback: [row] }).success, false);
  assert.equal(interviewFeedbackSchema.safeParse({ feedback: Array(5).fill({ ...row, relevance: 6 }) }).success, false);
  assert.equal(questionsSchema.safeParse({ questions: [] }).success, false);
  assert.equal(draftSchema.safeParse({ cover_letter: "", application_email: "draft", follow_up: "draft" }).success, false);
  assert.equal(feedbackSchema.safeParse({ job_url: "https://user:password@jobs.example/a", title: "Role", company: "Company", verdict: "expired" }).success, false);
});

test("progress loader pages owner-scoped records, excludes CV text and does not turn errors into zeroes", async () => {
  const requests: { table: string; filters: [string, unknown][]; start?: number }[] = [];
  function mock(fail: boolean) {
    return { from(table: string) {
      const req = { table, filters: [] as [string, unknown][], start: 0 }; requests.push(req);
      const q = { select() { return q; }, eq(k: string, v: unknown) { req.filters.push([k, v]); return q; }, order() { return q; }, not() { return q; }, limit() { return q; }, range(start: number) { req.start = start; return q; },
        then(resolve: (v: unknown) => unknown) {
          const row = { id: "app", role: "Intern", company: "Company", status: "Applied", application_date: "2026-11-12", deadline_date: null, interview_date: null, follow_up_date: null };
          return Promise.resolve({ data: table === "applications" && !fail ? req.start === 0 ? Array(500).fill(row) : [{ ...row, id: "last" }] : [], error: fail ? {} : null }).then(resolve);
        } }; return q;
    } } as unknown as SupabaseClient<Database>;
  }
  const data = await loadCareerProgress(mock(false), "owner");
  assert.equal(data.applications?.length, 501); assert.equal(data.learning?.completed, 0); assert.ok(requests.some(r => r.table === "applications" && r.start === 500));
  assert.ok(requests.every(r => r.filters.some(([k, v]) => k === "user_id" && v === "owner")));
  const failed = await loadCareerProgress(mock(true), "owner"); assert.equal(failed.trends, null); assert.equal(failed.interviews, null); assert.equal(failed.applications, null); assert.equal(failed.learning, null); assert.ok(failed.warnings.length >= 3);
});
