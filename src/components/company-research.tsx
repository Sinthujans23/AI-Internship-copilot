"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CompanyReportCard } from "@/components/company-report";
import { defaultPreferences, preferencesSchema, type CompanyReport } from "@/lib/company/schema";

const field = "mt-1 w-full rounded border border-slate-300 bg-white p-2";
export function CompanyResearch() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [reports, setReports] = useState<CompanyReport[]>([]);
  const [urls, setUrls] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [hideMismatches, setHideMismatches] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const [prefResponse, reportResponse] = await Promise.all([fetch("/api/career-preferences", { signal: controller.signal }), fetch("/api/company-research", { signal: controller.signal })]);
        const prefData = await prefResponse.json(); const reportData = await reportResponse.json();
        if (!prefResponse.ok) throw new Error(prefData.error || "Could not load preferences.");
        if (!reportResponse.ok) throw new Error(reportData.error || "Could not load reports.");
        const parsedPreferences = preferencesSchema.parse(prefData);
        setPreferences(parsedPreferences); setReports(reportData);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Load failed."); }
    }
    void load(); return () => controller.abort();
  }, []);
  async function research(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setProgress("");
    const failures: string[] = [];
    try {
      const links = [...new Set(urls.split(/\r?\n/).map(value => value.trim()).filter(Boolean))];
      if (!links.length || links.length > 5) throw new Error("Enter one to five company/job links, one per line.");
      const value = preferencesSchema.parse(preferences);
      for (const [index, url] of links.entries()) {
        setProgress(`Analyzing company ${index + 1} of ${links.length}. Reports appear one by one...`);
        try {
          const response = await fetch("/api/company-research", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, preferences: value }) });
          const data = await response.json(); if (!response.ok) throw new Error(data.error || "Analysis failed.");
          setReports(current => [data, ...current.filter(report => report.source_url !== data.source_url)]);
        } catch (error) { failures.push(`Link ${index + 1}: ${error instanceof Error ? error.message : "Analysis failed."}`); }
      }
      setProgress("Analysis finished. Unknown preferences need employer verification.");
      if (failures.length) setError(failures.join("\n"));
    } catch (error) { setError(error instanceof Error ? error.message : "Research failed."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this saved company report?")) return;
    try {
      const response = await fetch(`/api/company-research?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Delete failed.");
      setReports(current => current.filter(report => report.id !== id));
    } catch (error) { setError(error instanceof Error ? error.message : "Delete failed."); }
  }
  const latest = reports.filter((report, index) => reports.findIndex(item => item.source_url === report.source_url) === index);
  const shortlist = latest.filter(report => !hideMismatches || !report.preference_checks.some(check => check.status === "mismatch")).sort((a, b) => {
    const mismatches = (report: CompanyReport) => report.preference_checks.filter(check => check.status === "mismatch").length;
    return mismatches(a) - mismatches(b) || (b.match?.score ?? -1) - (a.match?.score ?? -1);
  });
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Company Intelligence and shortlist</h1><p className="mt-2 text-slate-600">Add official company/job links and compare their published evidence with your CV.</p><Link href="/profile" className="text-violet-700 underline">Upload or review your CV first</Link></div>
    <form onSubmit={research} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><label className="block font-medium">Official company/job links — one per line<textarea required disabled={busy} rows={4} value={urls} onChange={event => setUrls(event.target.value)} placeholder="https://company.example/careers/job-title" className={field} /></label><p className="text-sm text-slate-600">Up to five links. Each uses evidence retrieval, AI and embeddings. Public readable HTML only, subject to publisher access restrictions. Company homepages do not establish vacancy requirements. Up to five researches per hour.</p><button disabled={busy} className="rounded bg-violet-700 px-4 py-2 text-white">{busy ? "Researching companies..." : "Build my shortlist"}</button></form>
    {progress && <p role="status" className="rounded bg-violet-50 p-3 text-violet-900">{progress}</p>}
    {error && <p role="alert" className="whitespace-pre-wrap rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Shortlist ({shortlist.length})</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideMismatches} onChange={event => setHideMismatches(event.target.checked)} />Hide explicit preference mismatches</label></div>
    <p className="text-sm text-slate-600">Sorted by fewer verified preference mismatches, then CV similarity. Unknown requirements remain provisional; no opening, salary, or certification acceptance is guaranteed.</p>
    {shortlist.map(report => <CompanyReportCard key={report.id} report={report} onDelete={() => void remove(report.id)} />)}
    {!shortlist.length && <p className="rounded border border-slate-200 bg-white p-5">No reports yet, or all were filtered. Add employer links above.</p>}
  </div>;
}
