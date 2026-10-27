"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CareerRequirements } from "./career-requirements";
import type { CareerPreferences } from "@/lib/company/schema";
import type { RankedJob } from "@/lib/job-search";

export function JobDiscovery({ initial, hasCv, initialWarning }: { initial: CareerPreferences; hasCv: boolean; initialWarning: string }) {
  const [preferences, setPreferences] = useState(initial);
  const [revision, setRevision] = useState(0);
  const role = preferences.target_role.slice(0, 120);
  const location = preferences.locations[0] || "";
  const remote = preferences.work_mode === "Remote";
  const internships = true;
  const [jobs, setJobs] = useState<RankedJob[]>([]);
  const [busy, setBusy] = useState(hasCv);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [cvName, setCvName] = useState("");
  useEffect(() => {
    // Search automatically; cancellation prevents stale responses on navigation.
    const controller = new AbortController();
    setJobs([]); setWarnings([]); setError(""); setSearched(false);
    if (!hasCv) { setBusy(false); return () => controller.abort(); }
    setBusy(true);
    async function search() {
      try {
        const response = await fetch("/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role, location, remote, internships }), signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Search failed.");
        if (!controller.signal.aborted) { setJobs(data.jobs); setWarnings(data.warnings); setCvName(data.cv_name); setSearched(true); }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Search failed.");
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void search();
    return () => controller.abort();
  }, [hasCv, role, location, remote, internships, revision]);
  return <div className="space-y-8">
    <header><h1 className="text-3xl font-bold">Find jobs for your profile</h1><p className="mt-2 text-slate-600">Jobs are found automatically using your saved career preferences and ranked against your latest CV skills.</p></header>
    {initialWarning && revision === 0 && <p role="alert" className="rounded bg-amber-50 p-3">{initialWarning}</p>}
    {!hasCv && <p className="rounded bg-violet-50 p-4"><Link href="/profile" className="underline">Upload your CV</Link> to receive automatic job recommendations.</p>}
    <CareerRequirements initial={initial} onSaved={value => { setPreferences(value); setRevision(current => current + 1); }} />
    <section className="space-y-2 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Your automatic search</h2>
      <p>{role} | {location || "All listed locations"} | {remote ? "Remote only" : "All work modes"} | {internships ? "Internship / trainee / student titles" : "All experience levels"}</p>
      <p className="text-sm text-slate-600">Sources: Arbeitnow Europe and UK. Up to 100 recent jobs per feed, refreshed every six hours. Mostly European coverage; LinkedIn and Indeed listings are not included. Remote roles may still have country restrictions.</p>
    </section>
    {busy && <p role="status" className="rounded bg-violet-50 p-4">Finding jobs for your CV automatically...</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {warnings.map(warning => <p key={warning} role="status" className="rounded bg-amber-50 p-3">{warning}</p>)}
    {searched && <section className="space-y-4"><h2 className="text-xl font-semibold">{jobs.length} public results · {cvName}</h2><p className="text-sm text-slate-600">Ranked by overlap of recognized skills mentioned in the listing. This is keyword overlap, not an AI suitability score or a list of mandatory requirements. Salary and work eligibility need checking on the original listing.</p>
      {!jobs.length && <p>No matching jobs were found in the available public feeds for your saved preferences. We will check again when you reopen this page; no unrelated jobs are presented as matches.</p>}
      {jobs.map(job => <article key={job.id} className="space-y-3 rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-bold">{job.title}</h3><p>{job.company} · {job.location || "Location not stated"}</p></div><p className="font-semibold text-violet-700">{job.overlap === null ? "Skill overlap unknown" : `${job.overlap}% skill overlap`}</p></div>
        <p className="text-sm text-slate-600">{job.source} · {job.remote ? "Remote listed — check restrictions" : "Remote not indicated"}{job.published ? ` · Posted ${job.published.slice(0, 10)}` : ""}</p>
        <p className="text-sm">Shared skills: {job.matched_skills.join(", ") || "None recognized"}</p><p className="text-sm">Other skills mentioned: {job.other_skills.join(", ") || "None recognized"}</p>
        <p className="whitespace-pre-line text-sm text-slate-600">{job.description.slice(0, 350)}{job.description.length > 350 ? "…" : ""}</p>
        <div className="flex flex-wrap gap-4"><a href={job.url} target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">View on {job.source} ↗</a></div>
      </article>)}
    </section>}
  </div>;
}
