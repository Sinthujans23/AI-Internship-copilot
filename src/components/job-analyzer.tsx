"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { JobDetails } from "@/lib/job-schema";
import { SkillChips } from "@/components/skill-chips";

export function JobAnalyzer({ initialText = "" }: { initialText?: string }) {
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<JobDetails | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  async function analyze(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setResult(null); setSaved(false);
    try {
      const response = await fetch("/api/analyze-job", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_text: text }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
    } catch (error) { setError(error instanceof Error ? error.message : "Analysis failed."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!result) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/applications", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ company: result.company || "Company not specified", role: result.role, job_text: text, job_analysis: result, status: "Applied" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Save failed.");
      setSaved(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Save failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <h1 className="text-3xl font-bold">Analyze a job post</h1>
    <form onSubmit={analyze} className="space-y-4 rounded-xl border bg-white p-5">
      <label className="block">Job post<textarea required minLength={40} maxLength={20000} rows={10} disabled={busy} value={text} onChange={event => { setText(event.target.value); setResult(null); setSaved(false); }} className="mt-2 w-full rounded border p-3" /></label>
      <button disabled={busy} className="rounded bg-violet-700 px-4 py-2 text-white">{busy ? "Working..." : "Analyze job"}</button>
    </form>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {result && <section className="space-y-5 rounded-xl border bg-white p-5">
      <div><h2 className="text-xl font-bold">{result.role}</h2><p>{result.company || "Company not specified"}</p></div>
      <div><h3 className="mb-2 font-semibold">Required skills</h3><SkillChips skills={result.skills_required} /></div>
      <div><h3 className="mb-2 font-semibold">Good to have</h3><SkillChips skills={result.good_to_have} /></div>
      <div><h3 className="mb-2 font-semibold">Responsibilities</h3><ul className="list-disc space-y-1 pl-5">{result.responsibilities.map((value, index) => <li key={index}>{value}</li>)}</ul></div>
      <button onClick={() => void save()} disabled={busy || saved} className="rounded bg-violet-700 px-4 py-2 text-white">{saved ? "Saved" : busy ? "Saving..." : "Save as application"}</button>
      {saved && <p role="status">Saved. <Link href="/dashboard" className="text-violet-700 underline">Open dashboard</Link></p>}
    </section>}
  </div>;
}
