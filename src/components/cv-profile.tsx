"use client";
import { useState, type FormEvent } from "react";
import type { Database } from "@/types/database";
import Link from "next/link";
import { savedCvReview } from "@/lib/cv-review-schema";
import { CvReviewCard } from "./cv-review";

type Cv = Database["public"]["Tables"]["cvs"]["Row"];
export function CvProfile({ initialCvs, initialError }: { initialCvs: Cv[]; initialError: string }) {
  const [cvs, setCvs] = useState(initialCvs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewError, setReviewError] = useState<{ id: string; message: string } | null>(null);
  const current = cvs[0];
  async function reviewCv(id: string) {
    setReviewing(id); setReviewError(null);
    try {
      const response = await fetch("/api/cvs/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv_id: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "CV review failed.");
      setCvs(previous => previous.map(cv => cv.id === id ? data.cv : cv));
    } catch (error) {
      setReviewError({ id, message: error instanceof Error ? error.message : "CV review failed." });
    } finally { setReviewing(null); }
  }
  async function analyze(id: string) {
    setBusy(true);
    try { await reviewCv(id); } finally { setBusy(false); }
  }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const body = new FormData(form);
    if (current) body.set("replace_id", current.id);
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/cvs", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setCvs(previous => [data.cv, ...previous.filter(cv => cv.id !== current?.id || data.warning)]);
      setMessage(data.warning || "CV saved. Your newest CV will be used for matching."); form.reset();
      await reviewCv(data.cv.id);
    } catch (error) { setError(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this CV and its PDF file?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/cvs/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed.");
      setCvs(previous => previous.filter(cv => cv.id !== id));
    } catch (error) { setError(error instanceof Error ? error.message : "Delete failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">CV Profile</h1><p className="mt-2 text-slate-600">Upload a text-based PDF up to 4 MB. Get a rating out of 10 and practical improvements, then explore jobs and companies.</p></div>
    <form onSubmit={upload} className="space-y-4 rounded-xl border bg-white p-5">
      <label className="block">CV PDF<input required disabled={busy} name="file" type="file" accept="application/pdf,.pdf" className="mt-2 block w-full rounded border p-2" /></label>
      <button disabled={busy} className="rounded bg-violet-700 px-4 py-2 text-white">{busy ? (reviewing ? "Analyzing CV..." : "Processing PDF...") : current ? "Replace current CV" : "Upload and analyze CV"}</button>
    </form>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {!cvs.length && <p>No CV yet. Upload one to get started.</p>}
    {cvs.map((cv, index) => { const review = savedCvReview(cv.analysis); return <section key={cv.id} className="space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="break-all text-lg font-semibold">{cv.file_name} {index === 0 && <span className="text-sm text-violet-700">(Current)</span>}</h2><button disabled={busy} onClick={() => void remove(cv.id)} className="rounded border border-red-200 px-3 py-2 text-red-700">Delete CV</button></div>
      {review ? <CvReviewCard review={review} /> : <div className="rounded border border-violet-200 bg-violet-50 p-4"><h3 className="font-semibold">Rate this CV out of 10</h3><p className="mt-1 text-sm">Get feedback on clarity, relevance, evidence, completeness and writing.</p><button disabled={busy} onClick={() => void analyze(cv.id)} className="mt-3 rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50">{reviewing === cv.id ? "Analyzing CV..." : "Analyze CV"}</button></div>}
      {reviewError?.id === cv.id && <p role="alert" className="rounded bg-amber-50 p-3 text-amber-900">Your CV is saved, but its review could not finish. {reviewError.message} Use Analyze CV to retry.</p>}
      <div className="flex flex-wrap gap-2">{cv.skills.map(skill => <span key={skill} className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800">{skill}</span>)}</div>
      <div className="flex flex-wrap gap-4 text-sm"><Link href={`/profile/pdf?cv_id=${encodeURIComponent(cv.id)}`} className="text-violet-700 underline">Edit original PDF layout</Link><a href={`/api/cvs/download?cv_id=${encodeURIComponent(cv.id)}`} className="text-violet-700 underline">Download PDF</a></div>
      {!cv.skills.length && <p className="text-slate-600">No skills recognized by the initial vocabulary. Your full CV text is still available for matching.</p>}
      <details open={index === 0}><summary className="cursor-pointer font-medium">Extracted text</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 font-sans">{cv.extracted_text}</pre></details>
    </section>; })}
  </div>;
}
