import test from "node:test";
import assert from "node:assert/strict";
import { companyUrl, isPublicAddress, extractWebsite } from "../src/lib/company/website";
import { verifyFacts, checkPreferences, ratingFromScore, verifyCoaching } from "../src/lib/company/evidence";
import { defaultPreferences, type CompanyFacts, type Coaching } from "../src/lib/company/schema";

test("company URLs reject private networks, credentials, unsafe protocols and ports", () => {
  for (const value of ["https://localhost", "https://127.1", "https://[::1]", "https://169.254.169.254", "https://user:pass@example.com", "http://example.com", "https://example.com:8080"]) assert.throws(() => companyUrl(value));
  for (const address of ["10.0.0.1", "192.168.1.2", "::ffff:127.0.0.1", "fc00::1", "198.51.100.1"]) assert.equal(isPublicAddress(address), false);
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(companyUrl("example.com/jobs#apply").href, "https://example.com/jobs");
});
test("website parsing excludes executable content and follows only same-origin research links", () => {
  const page = extractWebsite('<html><head><title>Company</title></head><body><p>We use Python.</p><script>secret()</script><a href="/careers">Careers</a><a href="https://other.example/jobs">Other jobs</a></body></html>', "https://example.com/");
  assert.ok(page.text.includes("Python")); assert.equal(page.text.includes("secret()"), false);
  assert.deepEqual(page.related, ["https://example.com/careers"]);
});
const source = { url: "https://example.com/job", title: "Job", text: "Remote Python role in Colombo. Salary LKR 100,000–150,000 monthly. AWS certification preferred.", retrieved_at: new Date().toISOString() };
const facts: CompanyFacts = { scope: "job_post", role: null, locations: [{ value: "Colombo", source_index: 0, quote: "role in Colombo" }], work_mode: { value: "Remote", source_index: 0, quote: "Remote Python role" }, salary: { minimum: 100000, maximum: 150000, currency: "LKR", period: "monthly", source_index: 0, quote: "Salary LKR 100,000–150,000 monthly" }, technologies: [{ value: "Python", source_index: 0, quote: "Remote Python role" }, { value: "React", source_index: 0, quote: "We use React" }], certifications: [{ value: "AWS", source_index: 0, quote: "AWS certification preferred" }] };
test("unsupported technology and invented salary amounts are discarded", () => {
  assert.deepEqual(verifyFacts(facts, [source]).technologies.map(fact => fact.value), ["Python"]);
  assert.equal(verifyFacts({ ...facts, salary: { ...facts.salary!, minimum: 999999 } }, [source]).salary, null);
  assert.equal(verifyFacts({ ...facts, certifications: [{ value: "Python", source_index: 0, quote: "Remote Python role" }] }, [source]).certifications.length, 0);
});
test("salary currency/period mismatches stay unknown; score converts to a ten-point estimate", () => {
  const verified = verifyFacts(facts, [source]);
  const checks = checkPreferences({ ...defaultPreferences, currency: "USD", salary_min: 2000, work_mode: "On-site", locations: ["Colombo"] }, verified);
  assert.equal(checks.find(check => check.name === "Salary")?.status, "unknown");
  assert.equal(checks.find(check => check.name === "Work mode")?.status, "mismatch");
  assert.equal(ratingFromScore(87), 8.7); assert.equal(ratingFromScore(null), null);
});
test("CV edits cannot invent metrics and interview answers need CV project evidence", () => {
  const coaching: Coaching = { fit_summary: "", email: { subject: "", body: "" }, learning_plan: [], similar_company_leads: [], cv_changes: [{ original_quote: "Built a Python API", suggested_text: "Built a Python API serving 1000 users", reason: "" }], interview_answers: [{ question: "", project_quote: "Led a team of 50", suggested_answer: "", follow_up: "" }] };
  const result = verifyCoaching(coaching, "Built a Python API for a student project.");
  assert.equal(result.cv_changes.length, 0); assert.equal(result.interview_answers.length, 0);
});
