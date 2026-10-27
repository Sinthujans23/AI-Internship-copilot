import test from "node:test";
import assert from "node:assert/strict";
import { finishCvReview, savedCvReview } from "../src/lib/cv-review-schema";
const item = (score: number) => ({ score, feedback: "Clear supporting information." });
const sample = {
  summary: "A useful starting CV with room for clearer project outcomes.",
  criteria: { clarity: item(2), relevance: item(2), evidence: item(1), completeness: item(1), writing: item(2) },
  strengths: ["Relevant projects."],
  improvements: [{ priority: "High", area: "Projects", recommendation: "Explain your contribution and the outcome without inventing metrics." }],
};
test("CV quality score is calculated from five criteria, ignoring an invented model total", () => {
  const review = finishCvReview({ ...sample, score: 10 });
  assert.equal(review.score, 8);
  assert.equal(savedCvReview({ cv_review: review })?.score, 8);
});
test("CV reviews reject scores outside the rubric and missing recommendations", () => {
  assert.throws(() => finishCvReview({ ...sample, criteria: { ...sample.criteria, evidence: item(3) } }));
  assert.throws(() => finishCvReview({ ...sample, improvements: [] }));
  assert.throws(() => finishCvReview({ ...sample, criteria: { ...sample.criteria, writing: item(1.5) } }));
});
test("legacy CV analysis and malformed cached reviews remain eligible for analysis", () => {
  for (const value of [null, {}, { skills: ["Python"] }, { cv_review: { score: 10 } }]) assert.equal(savedCvReview(value), null);
});
