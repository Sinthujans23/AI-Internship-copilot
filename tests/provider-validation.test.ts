import test from "node:test";
import assert from "node:assert/strict";
import { validateAIJson } from "../src/lib/ai/structured";
import { jobSchema } from "../src/lib/job-schema";
import { matchCvToJob } from "../src/lib/matching";

test("malformed and wrong-shape AI responses fail validation", () => {
  assert.throws(() => validateAIJson("not JSON", jobSchema), /invalid data/);
  assert.throws(() => validateAIJson('{"role":42}', jobSchema), /invalid data/);
});

test("matching service results must partition the requested skills", async () => {
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.MATCHING_SERVICE_URL;
  const previousKey = process.env.MATCHING_SERVICE_API_KEY;
  process.env.MATCHING_SERVICE_URL = "http://example.invalid";
  process.env.MATCHING_SERVICE_API_KEY = "test-only-key";
  const cv = { skills: ["Python"], extracted_text: "Python project" };
  const job = { role: "Intern", company: null, skills_required: ["Python", "SQL"], good_to_have: [], responsibilities: [] };
  try {
    globalThis.fetch = async () => Response.json({ score: 75, matched_skills: ["Python"], missing_skills: ["SQL"] });
    assert.equal((await matchCvToJob(cv, job)).score, 75);
    globalThis.fetch = async () => Response.json({ score: 100, matched_skills: ["Unrequested skill"], missing_skills: [] });
    await assert.rejects(matchCvToJob(cv, job), /invalid data/);
    globalThis.fetch = async () => { throw new Error("offline"); };
    await assert.rejects(matchCvToJob(cv, job), /could not be reached/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.MATCHING_SERVICE_URL; else process.env.MATCHING_SERVICE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.MATCHING_SERVICE_API_KEY; else process.env.MATCHING_SERVICE_API_KEY = previousKey;
  }
});
