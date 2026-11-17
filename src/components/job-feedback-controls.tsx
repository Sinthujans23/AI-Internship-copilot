"use client";
import { useState } from "react";
import type { JobFeedback } from "@/lib/career/schema";
import { canonicalJobUrl } from "@/lib/applications";
import { careerRequest } from "./career-picker";
export function JobFeedbackControls({ job, feedback, onSaved }: { job: { url: string; title: string; company: string }; feedback?: JobFeedback; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  async function save(verdict: JobFeedback["verdict"] | null) {
    setBusy(true); setError("");
    try { if (verdict) await careerRequest("/api/jobs/feedback", "POST", { job_url: job.url, title: job.title, company: job.company, verdict });
      else await careerRequest(`/api/jobs/feedback?url=${encodeURIComponent(canonicalJobUrl(job.url))}`, "DELETE"); onSaved();
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-2"><div className="flex flex-wrap gap-3">{([['relevant', 'Relevant'], ['not_relevant', 'Not relevant'], ['expired', 'Report expired']] as const).map(([verdict, label]) => <button key={verdict} disabled={busy} aria-pressed={feedback?.verdict === verdict} onClick={() => void save(verdict)} className={`rounded border px-3 py-1 text-sm ${feedback?.verdict === verdict ? "bg-violet-100" : ""}`}>{label}</button>)}{feedback && <button disabled={busy} onClick={() => void save(null)} className="text-sm underline">Undo feedback</button>}</div>{error && <p role="alert">{error}</p>}</div>;
}
