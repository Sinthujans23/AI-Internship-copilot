"use client";
import { SaveApplication } from "./save-application";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CareerRequirements } from "./career-requirements";
import type { CareerPreferences } from "@/lib/company/schema";
import type { HybridJob } from "@/lib/hybrid-jobs";

export function JobDiscovery({ initial, hasCv, initialWarning }: { initial: CareerPreferences; hasCv: boolean; initialWarning: string }) {
  const [preferences, setPreferences] = useState(initial);
  const [revision, setRevision] = useState(0);
  const role = preferences.target_role.slice(0, 120);
  const location = preferences.locations.join(", ");
  const remote = preferences.work_mode === "Remote";
  const internships = true;
  const [jobs, setJobs] = useState<HybridJob[]>([]);
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
      <p>{role} | {location || "All listed locations"} | {preferences.work_mode} | {internships ? "Internship / trainee / student titles" : "All experience levels"}</p>
      <p className="text-sm text-slate-600">Sources: Arbeitnow Europe/UK, Jobicy remote internships, and IFS public Sri Lanka/India openings. Feeds refresh every six hours; personal results cache for one hour. Regional coverage is limited to this employer, and there may be no current internships. LinkedIn/Indeed are not scraped. Remote eligibility still needs checking.</p>
    </section>
    {busy && <p role="status" className="rounded bg-violet-50 p-4">Finding jobs for your CV automatically...</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {warnings.map(warning => <p key={warning} role="status" className="rounded bg-amber-50 p-3">{warning}</p>)}
    {searched && <section className="space-y-4"><h2 className="text-xl font-semibold">{jobs.length} public results · {cvName}</h2><p className="text-sm text-slate-600">Scores combine skill coverage, semantic relevance and saved preferences. Preferences affect ranking, not strict eligibility filters: mismatches remain visible with explanations. These are recommendation relevance scores, not hiring probabilities. Top 30 preliminary candidates receive semantic evaluation.</p>
      {!jobs.length && <p>No internships were found in the available public feeds. Try again later; current source coverage is limited.</p>}
      {jobs.map(job => <article key={job.id} className="space-y-3 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-bold">{job.title}</h3><p>{job.company} | {job.location || "Location unknown"}</p></div><p className="font-semibold text-violet-700">{job.score}/100 relevance</p></div>
        <p className="text-sm text-slate-600">{job.work_mode || "Work mode unknown"} | {job.source} | {job.published ? `Posted ${job.published.slice(0,10)}` : "Posting date unknown"}</p>
        <p className="text-sm">{job.salary ? `Salary: ${job.salary.min}-${job.salary.max} ${job.salary.currency} / ${job.salary.period}` : "Salary unknown - not supplied by source"}</p>
        <p className="text-xs text-slate-500">Fetched: {job.fetched_at ? new Date(job.fetched_at).toLocaleString() : "Unknown"}. {job.expires_at ? `Expires ${job.expires_at}` : "Expiry unknown; verify the listing is still open."}</p>
        <p className="text-sm text-emerald-800">Matched skills: {job.matched_skills.join(", ") || "None recognized"}</p>
        <p className="text-sm text-red-800">Required skills not found in CV: {job.missing_required.join(", ") || "None recognized"}</p>
        <p className="text-sm text-amber-800">Preferred skills not found in CV: {job.missing_preferred.join(", ") || "None recognized"}</p>
        <p className="text-sm">Other mentions (not classified requirements): {job.mentioned_skills.join(", ") || "None"}</p>
        <details className="rounded bg-slate-50 p-3"><summary className="cursor-pointer font-medium">Why this recommendation?</summary>
          <ul className="mt-3 space-y-2 text-sm">{job.components.map(c=><li key={c.name}>{c.name}: {c.value===null ? "Unknown / unavailable" : `${Math.round(c.value*100)}%`} | base weight {c.weight}%</li>)}</ul>
          <p className="mt-2 text-xs">Unknown components are excluded and remaining weights renormalized. A high score with missing data has limited evidence.</p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">{job.explanations.map(e=><li key={e}>{e}</li>)}</ul>
        </details>
        <p className="whitespace-pre-line text-sm text-slate-600">{job.description.slice(0,350)}{job.description.length>350 ? "..." : ""}</p>
        <div className="flex flex-wrap gap-4"><a href={job.url} target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">View listing on {job.source}</a>{job.application_url ? <a href={job.application_url} target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">Official application</a> : <span className="text-xs text-slate-500">Direct employer application link unavailable; apply through the source listing.</span>}</div>
        <SaveApplication company={job.company} role={job.title} url={job.application_url || job.url} text={job.description} />
      </article>)}
    </section>}
  </div>;
}
