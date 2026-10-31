"use client";
import { useEffect, useState } from "react";
import { reviewV2Schema, savedV2, type ReviewV2 } from "@/lib/cv-v2/schema";
import { cvReviewSchema, savedCvReview } from "@/lib/cv-review-schema";
import { CvReviewCard } from "./cv-review";
import { CopyButton } from "./copy-button";

function ReviewCard({ review, outdated }: { review: ReviewV2; outdated: boolean }) {
  return <div className="space-y-4 rounded-xl border border-violet-200 bg-violet-50 p-5">
    <div className="flex flex-wrap items-center gap-4"><p className="text-4xl font-bold text-violet-800">{review.score}/10</p><div><h3 className="text-xl font-semibold">Explainable CV Analyzer v2</h3><p className="text-sm">{review.mode === "hybrid" ? "Deterministic checks + evidence-checked AI" : "Deterministic review — AI feedback unavailable"}</p></div></div>
    {outdated && <p role="status" className="rounded bg-amber-100 p-3">Outdated: this review describes different CV text. Analyze the current version before using this score.</p>}
    <p className="text-sm">Coaching estimate only. Not an official ATS score or hiring probability.</p>
    {review.warnings.some(w=>/evidence.*not found|quoted evidence/i.test(w))&&<p role="status" className="rounded bg-amber-100 p-3 text-sm">Some AI feedback could not be linked to exact CV text. Those suggestions were excluded, not hidden. Categories marked rules still show the deterministic score; this does not mean your CV lacks relevance or good writing. Choose Analyze again to use the updated evidence selection.</p>}
    <p className="text-sm">Each category identifies its scoring source. Missing AI feedback does not remove your CV text, detected sections, skills or rule-based recommendations. Relevance here describes your CV, not a match to a specific job.</p>
    {review.warnings.map((warning, i) => <p key={i} className="rounded bg-amber-50 p-3 text-sm">{warning}</p>)}
    <div className="grid gap-3 sm:grid-cols-2">{Object.entries(review.criteria).map(([name, category]) => <div key={name} className="rounded bg-white p-3"><h4 className="font-semibold capitalize">{name}: {category.score}/2</h4><p className="text-xs text-violet-700">{category.basis}</p><p className="mt-2 text-sm">{category.explanation}</p>{category.evidence && <details className="mt-2 text-sm"><summary>CV evidence</summary><blockquote className="whitespace-pre-wrap border-l-2 pl-2">{category.evidence}</blockquote></details>}</div>)}</div>
    <section><h4 className="font-semibold">Detected, missing and incomplete sections</h4><div className="mt-2 grid gap-2 sm:grid-cols-2">{review.sections.map(section => <div key={section.name} className="rounded bg-white p-3"><p className="font-medium capitalize">{section.name}: {section.status}</p><p className="text-xs">{section.heading ? `Heading: ${section.heading}` : "No heading detected"}{section.line ? ` · line ${section.line}` : ""}</p><p className="mt-1 text-sm">{section.reason}</p>{section.evidence && <details className="mt-1 text-sm"><summary>Detected text</summary><p className="whitespace-pre-wrap">{section.evidence}</p></details>}</div>)}</div></section>
    <section className="grid gap-4 sm:grid-cols-2"><div><h4 className="font-semibold">Strengths</h4><ul className="mt-2 list-disc pl-5">{review.strengths.map((value, i) => <li key={i}>{value}</li>)}</ul>{!review.strengths.length && <p>Not enough recognized structure to identify strengths.</p>}</div><div><h4 className="font-semibold">Areas to improve</h4><ul className="mt-2 list-disc pl-5">{review.weaknesses.map((value, i) => <li key={i}>{value}</li>)}</ul>{!review.weaknesses.length && <p>No issues flagged by these checks. This does not guarantee a complete CV.</p>}</div></section>
    <section><h4 className="font-semibold">Prioritized recommendations and before/after suggestions</h4><div className="mt-3 space-y-3">{review.improvements.map((item, i) => <div key={i} className="space-y-2 rounded bg-white p-3"><h5 className="font-semibold">{item.priority} · {item.area} <span className="text-xs">({item.source})</span></h5><p>{item.issue}</p><p>{item.recommendation}</p>{item.evidence && <blockquote className="whitespace-pre-wrap border-l-2 pl-2 text-sm text-slate-600">{item.evidence}</blockquote>}{item.before && item.after && <div className="grid gap-2 sm:grid-cols-2"><div><b>Before</b><p>{item.before}</p></div><div><b>Suggested wording — verify first</b><p>{item.after}</p><CopyButton text={item.after} label="Copy suggestion" /></div></div>}</div>)}</div></section>
    {!review.improvements.length&&<p>No actionable recommendations were returned by this review. This is not a guarantee that the CV needs no improvements.</p>}
    {!review.improvements.some(item=>item.before&&item.after)&&<p className="text-sm">No before/after rewrite passed the evidence and truthfulness checks. Available recommendations above can still guide your edits; no unsupported wording is filled in.</p>}
    <details><summary className="font-medium">How to interpret this score and its limitations</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{review.limitations.map((value, i) => <li key={i}>{value}</li>)}</ul></details>
    <p className="text-xs">Rubric {review.rubric_version} · {new Date(review.reviewed_at).toISOString().slice(0, 10)}. Each category is out of 2; total is out of 10.</p>
  </div>;
}
type History = { id: string; version: number; status: string; result: unknown; created_at: string; outdated: boolean };
export function CvReviewV2({ cvId, text, analysis, busy, reviewing, onAnalyze }: { cvId: string; text: string; analysis: unknown; busy: boolean; reviewing: boolean; onAnalyze: (force: boolean) => void }) {
  const current = savedV2(analysis);
  const legacy = savedCvReview(analysis);
  const [history, setHistory] = useState<History[]>([]);
  const [historyError, setHistoryError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState("");
  const [hash, setHash] = useState("");
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setSelected(""); setHistoryError(""); setHash("");
    // Compare content locally even when the history migration has not been run yet.
    void crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(bytes => {
      if (!controller.signal.aborted) setHash(Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, "0")).join(""));
    }).catch(() => { /* History endpoint also supplies the server-computed hash. */ });
    async function load() {
      try {
        const response = await fetch(`/api/cvs/review?cv_id=${encodeURIComponent(cvId)}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "History unavailable.");
        if (!controller.signal.aborted) { setHistory(data.history); setHash(data.current_hash); }
      } catch (error) { if (!controller.signal.aborted) setHistoryError(error instanceof Error ? error.message : "History unavailable."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [cvId, text, current?.reviewed_at]);
  const past = history.find(item => item.id === selected);
  const pastV2 = reviewV2Schema.safeParse(past?.result);
  const pastV1 = cvReviewSchema.safeParse(past?.result);
  const visible = selected ? (pastV2.success ? pastV2.data : null) : current;
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-3"><button disabled={busy} onClick={() => onAnalyze(!!current)} className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50">{reviewing ? "Analyzing CV..." : current ? "Analyze again (new version)" : "Analyze CV with v2"}</button><p className="text-xs text-slate-600">Five new analyses per hour. AI requests may use provider credits; saved history is reused.</p></div>
    {visible && <ReviewCard review={visible} outdated={!!hash && visible.input_hash !== hash} />}
    {!selected && !current && legacy && <div><p className="mb-2 text-sm">Previous v1 review preserved. Run v2 for section detection and explainable feedback.</p><CvReviewCard review={legacy} /></div>}
    {selected && pastV1.success && <CvReviewCard review={pastV1.data} />}
    {!visible && !legacy && !selected && <p>Upload or analyze this CV to see section detection, scores, evidence and improvements.</p>}
    <details className="rounded border p-3"><summary className="font-semibold">Analysis history (latest 50 for this CV)</summary>
      {loading && <p role="status">Loading history...</p>}{historyError && <p role="alert" className="mt-2 text-red-700">{historyError}</p>}
      <label className="mt-3 block">Review version<select value={selected} onChange={event => setSelected(event.target.value)} className="mt-1 w-full rounded border p-2"><option value="">Latest saved review</option>{history.map(item => <option key={item.id} value={item.id}>v{item.version} · {new Date(item.created_at).toISOString()} · {item.status}{item.outdated ? " · old content/rubric" : ""}</option>)}</select></label>
      {past && !pastV1.success && !pastV2.success && <p className="mt-2 text-sm">This attempt is {past.status}; no usable review is available. Running attempts can be retried after two minutes.</p>}
      <p className="mt-2 text-xs">Replacing or editing a PDF creates a new CV version. Earlier CVs and reviews stay below until you explicitly delete them.</p>
    </details>
  </div>;
}
