"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { JobSearch, RankedJob } from "@/lib/job-search";
import { platformSearches } from "@/lib/job-search-links";

export function JobDiscovery({ initial, hasCv, initialWarning }: { initial: JobSearch; hasCv: boolean; initialWarning: string }) {
  const [query, setQuery] = useState(initial);
  const [jobs, setJobs] = useState<RankedJob[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [searched, setSearched] = useState(false);
  const [cvName, setCvName] = useState("");
  function change(next: JobSearch) { setQuery(next); setSearched(false); setJobs([]); setWarnings([]); }
  async function search(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setWarnings([]); setJobs([]); setSearched(false);
    try {
      const response = await fetch("/api/jobs/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(query) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Search failed.");
      setJobs(data.jobs); setWarnings(data.warnings); setCvName(data.cv_name); setSearched(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Search failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-8">
    <header><h1 className="text-3xl font-bold">Find jobs for your profile</h1><p className="mt-2 text-slate-600">Search public listings, compare mentioned skills with your latest CV, and open the original listing to apply.</p></header>
    {initialWarning && <p role="alert" className="rounded bg-amber-50 p-3">{initialWarning}</p>}
    {!hasCv && <p className="rounded bg-violet-50 p-4"><Link href="/profile" className="underline">Upload your CV</Link> to rank public jobs. External platform search links work below without a CV.</p>}
    <form onSubmit={search} className="space-y-4 rounded-xl border bg-white p-5">
      <div className="grid gap-4 sm:grid-cols-2"><label>Target role<input required minLength={2} maxLength={120} disabled={busy} value={query.role} onChange={e => change({ ...query, role: e.target.value })} className="mt-1 w-full rounded border p-2" /></label><label>Location<input maxLength={120} disabled={busy} placeholder="City/country, or leave blank" value={query.location} onChange={e => change({ ...query, location: e.target.value })} className="mt-1 w-full rounded border p-2" /></label></div>
      <div className="flex flex-wrap gap-5"><label><input type="checkbox" disabled={busy} checked={query.remote} onChange={e => change({ ...query, remote: e.target.checked })} /> Remote only</label><label><input type="checkbox" disabled={busy} checked={query.internships} onChange={e => change({ ...query, internships: e.target.checked })} /> Internship / trainee / student titles only</label></div>
      <button disabled={busy || !hasCv} className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50">{busy ? "Searching public jobs..." : "Find jobs matching my CV"}</button>
      <p className="text-sm text-slate-600">Free feeds: Arbeitnow Europe and UK, up to 100 recent jobs each, cached for six hours. Coverage is mostly European; this is not a complete global search. Location filters match the listing text; remote does not guarantee eligibility in your country.</p>
    </form>
    <section className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Search more platforms</h2><p className="mt-1 text-sm text-slate-600">Opens the platform with your role/location. These are search links, not fetched or CV-ranked listings.</p><div className="mt-3 flex flex-wrap gap-3">{platformSearches(query).map(link => <a key={link.name} href={link.url} target="_blank" rel="noopener noreferrer" className="rounded border px-4 py-2 text-violet-700">{link.name} ↗</a>)}</div></section>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {warnings.map(warning => <p key={warning} role="status" className="rounded bg-amber-50 p-3">{warning}</p>)}
    {searched && <section className="space-y-4"><h2 className="text-xl font-semibold">{jobs.length} public results · {cvName}</h2><p className="text-sm text-slate-600">Ranked by overlap of recognized skills mentioned in the listing. This is keyword overlap, not an AI suitability score or a list of mandatory requirements. Salary and work eligibility need checking on the original listing.</p>
      {!jobs.length && <p>No listings matched these filters in the available feeds. Try a broader role/location, or use the platform links above.</p>}
      {jobs.map(job => <article key={job.id} className="space-y-3 rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><div><h3 className="text-lg font-bold">{job.title}</h3><p>{job.company} · {job.location || "Location not stated"}</p></div><p className="font-semibold text-violet-700">{job.overlap === null ? "Skill overlap unknown" : `${job.overlap}% skill overlap`}</p></div>
        <p className="text-sm text-slate-600">{job.source} · {job.remote ? "Remote listed — check restrictions" : "Remote not indicated"}{job.published ? ` · Posted ${job.published.slice(0, 10)}` : ""}</p>
        <p className="text-sm">Shared skills: {job.matched_skills.join(", ") || "None recognized"}</p><p className="text-sm">Other skills mentioned: {job.other_skills.join(", ") || "None recognized"}</p>
        <p className="whitespace-pre-line text-sm text-slate-600">{job.description.slice(0, 350)}{job.description.length > 350 ? "…" : ""}</p>
        <div className="flex flex-wrap gap-4"><a href={job.url} target="_blank" rel="noopener noreferrer" className="text-violet-700 underline">View on {job.source} ↗</a></div>
      </article>)}
    </section>}
  </div>;
}
