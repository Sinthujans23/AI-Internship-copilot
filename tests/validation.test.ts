import test from "node:test";
import assert from "node:assert/strict";
import { jobSchema, jobInputSchema } from "../src/lib/job-schema";
import { extractCvSkills } from "../src/lib/cv-skills";
import { matchSchema } from "../src/lib/matching-schema";

test("invalid job JSON and short posts are rejected", () => {
  assert.equal(jobInputSchema.safeParse({ job_text: "short" }).success, false);
  assert.equal(jobSchema.safeParse({ role: "Intern", company: null, skills_required: "Python" }).success, false);
  assert.equal(jobSchema.safeParse({ role: "Intern", company: null, skills_required: ["Python"], good_to_have: [], responsibilities: [] }).success, true);
});
test("skill extraction respects word boundaries and literal punctuation", () => {
  const skills = extractCvSkills("JavaScript, C++, C#, Next.js, Python. I collaborated with a team.");
  assert.ok(skills.includes("JavaScript") && skills.includes("C++") && skills.includes("C#") && skills.includes("Next.js"));
  assert.equal(skills.includes("Java"), false);
  assert.equal(extractCvSkills("A paper about pythons.").includes("Python"), false);
});
test("match scores must be finite integers from 0 to 100", () => {
  for (const score of [-1, 101, 3.5, NaN]) assert.equal(matchSchema.safeParse({ score, matched_skills: [], missing_skills: [] }).success, false);
});
