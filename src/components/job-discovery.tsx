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
  const [showMismatches,setShowMismatches]=useState(false);
  const [searchedAt,setSearchedAt]=useState("");
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
        if (!controller.signal.aborted) { setJobs(data.jobs); setSearchedAt(data.searched_at); setWarnings(data.warnings); setCvName(data.cv_name); setSearched(true); }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Search failed.");
      } finally { if (!controller.signal.aborted) setBusy(false); }
    }
    void search();
    return () => controller.abort();
  }, [hasCv, role, location, remote, internships, revision]);
  const visibleJobs=jobs.filter(job=>showMismatches || job.preference_fit!=="mismatch");
  const hidden=jobs.filter(job=>job.preference_fit==="mismatch").length;
  return <div className="space-y-8">
    <header><h1 className="text-3xl font-bold">Find jobs for your profile</h1><p className="mt-2 text-slate-600">Saved role, location, work mode and salary requirements are checked first. Your CV skills and semantic relevance rank jobs within those groups.</p></header>
    {initialWarning && revision === 0 && <p role="alert" className="rounded bg-amber-50 p-3">{initialWarning}</p>}
    {!hasCv && <p className="rounded bg-violet-50 p-4"><Link href="/profile" className="underline">Upload your CV</Link> to receive automatic job recommendations.</p>}
    <CareerRequirements initial={initial} onSaved={value => { setPreferences(value); setRevision(current => current + 1); }} />
    <section className="space-y-2 rounded-xl border bg-white p-5">
      <h2 className="font-semibold">Your automatic search</h2>
      <p>{role} | {location || "All listed locations"} | {preferences.work_mode} | Internship / trainee titles</p>
      <p>Salary preference: {preferences.salary_min ?? "No minimum"} to {preferences.salary_max ?? "No maximum"} {preferences.currency} / {preferences.salary_period}</p>
      {preferences.notes && <p>Additional requirements (need manual verification): {preferences.notes}</p>}
      <p className="text-sm text-slate-600">Sources: ITPro.lk internships across Sri Lankan employers, IFS, Bosch India, the LinkedIn employer India careers board, Arbeitnow, Jobicy and Himalayas remote internships (Sri Lanka, India and worldwide). Feeds refresh every six hours; personal results cache for one hour. This does not search the LinkedIn jobs platform or the entire web. Availability and regional coverage vary; remote eligibility needs checking.</p>
    </section>
    {busy && <p role="status" className="rounded bg-violet-50 p-4">Finding jobs for your CV and saved requirements...</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {warnings.map(warning => <p key={warning} role="status" className="rounded bg-amber-50 p-3">{warning}</p>)}
    {searched && <section className="space-y-4"><h2 className="text-xl font-semibold">{visibleJobs.length} jobs across {new Set(visibleJobs.map(j=>j.company.toLowerCase().trim())).size} companies · {cvName}</h2><p className="text-sm text-slate-600">Requirement matches come first, then jobs with unknown details. Known requirement mismatches are hidden by default. Scores combine CV skills, semantic relevance and available preference evidence; they are not hiring probabilities. At most 30 candidates are evaluated.</p>
      <p className="text-sm">Search snapshot: {searchedAt ? new Date(searchedAt).toLocaleString() : "Unknown"}. Source details may have changed; check the original listing.</p>
      <label className="block"><input type="checkbox" checked={showMismatches} onChange={e=>setShowMismatches(e.target.checked)} /> Show jobs that do not match my requirements ({hidden})</label>
      {!visibleJobs.length && jobs.length>0 && <p>No jobs in this result set match your saved requirements without a known mismatch. Broaden requirements or show mismatches; no listings or salary details are invented.</p>}
      {!jobs.length && <p>No internships were found in the available public feeds. Try again later; current source coverage is limited.</p>}
      {visibleJobs.map(job => <article key={job.id} className="space-y-3 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-bold">{job.title}</h3><p>{job.company} | {job.location || "Location unknown"}</p></div><p className="font-semibold text-violet-700">{job.score}/100 relevance</p></div>
        <p className="font-medium">Requirements: {job.preference_fit==="match"?"Matches available listing fields":job.preference_fit==="mismatch"?"Does not match one or more requirements":"Needs verification: some information is unknown"}</p>
        <ul className="space-y-1 text-sm">{job.preference_checks?.map(check=><li key={check.name}><b>{check.name}: {check.status=== "unknown"?"Needs verification":check.status}</b>: {check.reason}</li>)}</ul>
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
