import { createHash } from "node:crypto";
import { extractCvSkills } from "../cv-skills";
import { detectSections } from "./sections";
import { aiFeedbackSchema, reviewV2Schema, type ReviewV2 } from "./schema";

export const textHash = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");
const contains = (text: string, quote: string) => quote.trim().length >= 4 && text.includes(quote);
const tokens = (text: string) => text.toLowerCase().match(/[\p{L}\p{N}+#.%-]+/gu) || [];
const safeWords = new Set("a an the and with using for to in of on by from as through developed built implemented designed tested improved created delivered integrated automated documented supported analyzed organised organized".split(" "));
export function safeRewrite(before: string, after: string) {
  // Reject new metrics, technology names or substantive words. Be conservative.
  const original = new Set(tokens(before));
  const revised = new Set(tokens(after));
  // Keep qualifiers: assisted/learning/planned work must not become completed ownership.
  const qualifiers = ["not", "no", "without", "learning", "beginner", "basic", "familiar", "assisted", "helped", "team", "prototype", "coursework", "student", "planned", "limited", "ongoing", "progress", "supervision"];
  if (qualifiers.some(word => original.has(word) && !revised.has(word))) return false;
  const actions = [
    ["built", "build", "building", "developed", "develop", "developing", "created", "create", "creating", "implemented", "implement", "implementing"],
    ["tested", "test", "testing"], ["designed", "design", "designing"], ["documented", "document", "documenting"],
    ["analyzed", "analyze", "analyzing"], ["automated", "automate", "automating"], ["integrated", "integrate", "integrating"],
    ["supported", "support", "supporting"], ["improved", "improve", "improving"], ["delivered", "deliver", "delivering"],
    ["organised", "organized", "organising", "organizing"],
  ];
  if (actions.some(group => group.some(word => revised.has(word)) && !group.some(word => original.has(word)))) return false;
  const numbers: string[] = before.match(/\d+(?:\.\d+)?%?/g) || [];
  return after.trim().length > 0 && (after.match(/\d+(?:\.\d+)?%?/g) || []).every(value => numbers.includes(value)) && tokens(after).every(word => original.has(word) || safeWords.has(word));
}
export function analyzeCv(text: string, ai?: unknown, warning?: string): ReviewV2 {
  if (text.length < 40 || text.length > 50000) throw new Error("CV text must contain 40–50,000 characters.");
  const sections = detectSections(text);
  const section = (name: string) => sections.find(item => item.name === name)!;
  const found = (name: string) => section(name).status === "detected";
  const headings = sections.filter(item => item.heading && item.status === "detected").length;
  const longLines = text.split(/\r?\n/).filter(line => line.split(/\s+/).length > 45).length;
  const skills = extractCvSkills(text);
  const proof = [section("projects").evidence, section("experience").evidence, section("achievements").evidence].join("\n");
  const measurable = /\b\d+(?:\.\d+)?\s*(?:%|users?|tests?|requests?|seconds?|ms\b|hours?|records?|students?|endpoints?)/i.test(proof);
  const concrete = /\b(?:built|developed|implemented|designed|tested|deployed|created|analyzed|automated)\b/i.test(proof);
  const rule = (score: number, explanation: string, evidence = "") => ({ score, explanation, evidence, basis: "rules" as const });
  const completeness = [found("contact"), found("education"), found("skills"), found("projects") || found("experience")].filter(Boolean).length / 2;
  const criteria: ReviewV2["criteria"] = {
    clarity: rule(headings >= 4 ? 2 : headings >= 2 ? 1 : 0, `${headings} recognized, populated headings. 4+ gives 2; 2–3 gives 1; otherwise 0. Visual layout is not assessed.`),
    completeness: rule(completeness, "0.5 each for contact, education, skills, and either projects or experience. Optional summary/certifications/awards do not reduce this score."),
    evidence: rule((concrete ? 1 : 0) + (measurable ? 1 : 0), "1 for an action verb in project/experience/achievement text; 1 for a measurable scope/outcome. Dates and phone numbers do not count. Metrics are not verified.", proof.slice(0, 700)),
    relevance: rule((skills.length ? 1 : 0) + (found("projects") || found("experience") ? 1 : 0), "Fallback proxy: 1 for recognized skills, 1 for projects/experience. Not a match to a specific job."),
    writing: rule(longLines === 0 ? 2 : longLines <= 3 ? 1 : 0, `${longLines} extracted lines exceed 45 words. Fallback checks concision only, not grammar or language fluency; PDF wrapping affects it.`),
  };
  const improvements: ReviewV2["improvements"] = [];
  const add = (area: string, issue: string, recommendation: string, evidence = "", priority: "High" | "Medium" | "Low" = "Medium") => improvements.push({ priority, area, issue, recommendation, evidence, before: "", after: "", source: "rules" });
  for (const item of sections.filter(item => item.status !== "detected")) {
    const core = ["contact", "education", "skills"].includes(item.name);
    add(item.name, `${item.status === "missing" ? "Heading not detected" : "Possibly incomplete section"}.`, core ? "Check the extracted text and add a clear section with your actual details if absent." : "Consider a clearly labelled section if you have relevant evidence. Do not invent content; projects can substitute for employment, and certifications/awards are optional.", item.evidence, core ? "High" : "Low");
  }
  if (!measurable) add("Project evidence", "No measurable scope/outcomes recognized in sampled project/experience text.", "Where truthful, describe scale, tests, users or an observed outcome. Measure first; do not invent a number.", proof.slice(0, 700));
  const weak = text.split(/\r?\n/).filter(line => /\b(?:responsible for|worked on|helped with|familiar with)\b/i.test(line)).slice(0, 4);
  for (const line of weak) add("Action verbs", "A vague description may hide your contribution.", "Name your actual action: built, tested, documented or analyzed, only if accurate. Specify the component, technology and purpose.", line.trim().slice(0, 700));
  const warnings = warning ? [warning] : [];
  let mode: ReviewV2["mode"] = "deterministic";
  if (ai !== undefined) {
    const parsed = aiFeedbackSchema.safeParse(ai);
    if (!parsed.success) warnings.push("Invalid AI feedback discarded. Deterministic checks are shown.");
    else {
      for (const key of ["relevance", "writing"] as const) {
        const item = parsed.data[key];
        if (contains(text, item.evidence)) { criteria[key] = { score: item.score, explanation: item.explanation, evidence: item.evidence, basis: "AI + evidence validation" }; mode = "hybrid"; }
        else warnings.push(`${key} AI score discarded: its quoted evidence was not found.`);
      }
      for (const item of parsed.data.feedback) {
        if (!contains(text, item.evidence)) { warnings.push("AI recommendation discarded because its evidence was not found."); continue; }
        const rewrite = item.before && contains(text, item.before) && safeRewrite(item.before, item.after);
        if (item.before && !rewrite) warnings.push("An unsupported before/after rewrite was removed; the evidence-backed recommendation remains.");
        improvements.push({ ...item, before: rewrite ? item.before : "", after: rewrite ? item.after : "", source: "AI" });
      }
    }
  }
  const order = { High: 0, Medium: 1, Low: 2 };
  improvements.sort((a, b) => order[a.priority] - order[b.priority]);
  return reviewV2Schema.parse({ version: 2, rubric_version: "2.0", input_hash: textHash(text), reviewed_at: new Date().toISOString(), mode,
    score: Object.values(criteria).reduce((total, value) => total + value.score, 0), criteria, sections,
    strengths: sections.filter(item => item.status === "detected").map(item => `${item.name}: usable text detected.`),
    weaknesses: improvements.filter(item => item.priority !== "Low").map(item => item.issue), improvements, warnings: [...new Set(warnings)],
    limitations: ["A text-based coaching estimate, not an official ATS score, hiring probability or verification of qualifications.", "Heading aliases are English and PDF reading order/line wrapping can cause misses. Incomplete means little text, not a verified absence of qualifications.", "Optional sections are not mandatory. Projects/coursework can substitute for paid experience.", "AI may misunderstand context. Quotes and conservative rewrite checks reduce fabrication but cannot prove semantic correctness; approve edits yourself.", "Only the first 700 characters of each detected section are sampled for evidence heuristics. No visual layout or factual achievement verification is performed."],
  });
}
