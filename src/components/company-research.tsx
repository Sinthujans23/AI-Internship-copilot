"use client";
import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { CompanyReportCard } from "@/components/company-report";
import { defaultPreferences, preferencesSchema, type CareerPreferences, type CompanyReport } from "@/lib/company/schema";

const field = "mt-1 w-full rounded border border-slate-300 bg-white p-2";
export function CompanyResearch() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [locationText, setLocationText] = useState("");
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
        setPreferences(parsedPreferences); setLocationText(parsedPreferences.locations.join(", ")); setReports(reportData);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Load failed."); }
    }
    void load(); return () => controller.abort();
  }, []);
  function update<K extends keyof CareerPreferences>(key: K, value: CareerPreferences[K]) { setPreferences(current => ({ ...current, [key]: value })); }
  async function persistPreferences() {
    const value = preferencesSchema.parse(preferences);
    const response = await fetch("/api/career-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save preferences.");
    return value;
  }
  async function save() {
    setBusy(true); setError(""); setProgress("");
    try { await persistPreferences(); setProgress("Preferences saved."); }
    catch (error) { setError(error instanceof Error ? error.message : "Save failed."); }
    finally { setBusy(false); }
  }
  async function research(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setProgress("");
    const failures: string[] = [];
    try {
      const links = [...new Set(urls.split(/\r?\n/).map(value => value.trim()).filter(Boolean))];
      if (!links.length || links.length > 5) throw new Error("Enter one to five company/job links, one per line.");
      const value = await persistPreferences();
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
  return <div className="space-y-6"><div><h1 className="text-3xl font-bold">Your company shortlist</h1><p className="mt-2 text-slate-600">Set your requirements, add official company/job links, and compare their published evidence with your CV.</p><Link href="/profile" className="text-violet-700 underline">Upload or review your CV first</Link></div>
    <section className="rounded-xl border border-slate-200 bg-white p-5"><h2 className="mb-4 text-xl font-semibold">Your requirements</h2><fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <label>Target role<input required value={preferences.target_role} onChange={event => update("target_role", event.target.value)} className={field} /></label>
      <label>Preferred locations (comma-separated)<input value={locationText} onChange={event => { setLocationText(event.target.value); update("locations", event.target.value.split(",").map(value => value.trim()).filter(Boolean)); }} placeholder="Colombo, Kandy" className={field} /></label>
      <label>Work mode<select value={preferences.work_mode} onChange={event => update("work_mode", event.target.value as CareerPreferences["work_mode"])} className={field}>{["Any", "Remote", "Hybrid", "On-site"].map(mode => <option key={mode}>{mode}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3"><label>Currency<select value={preferences.currency} onChange={event => update("currency", event.target.value as CareerPreferences["currency"])} className={field}>{["LKR", "USD", "INR", "EUR", "GBP", "AUD", "CAD"].map(currency => <option key={currency}>{currency}</option>)}</select></label><label>Salary period<select value={preferences.salary_period} onChange={event => update("salary_period", event.target.value as CareerPreferences["salary_period"])} className={field}>{["monthly", "yearly", "hourly"].map(period => <option key={period}>{period}</option>)}</select></label></div>
      <label>Minimum salary (optional)<input type="number" min={0} value={preferences.salary_min ?? ""} onChange={event => update("salary_min", event.target.value === "" ? null : Number(event.target.value))} className={field} /></label>
      <label>Maximum salary (optional)<input type="number" min={0} value={preferences.salary_max ?? ""} onChange={event => update("salary_max", event.target.value === "" ? null : Number(event.target.value))} className={field} /></label>
      <label className="sm:col-span-2">Other requirements<textarea maxLength={2000} rows={2} value={preferences.notes} onChange={event => update("notes", event.target.value)} className={field} /></label>
      <button type="button" onClick={() => void save()} className="rounded border border-violet-300 px-4 py-2 text-violet-800 sm:col-span-2">Save requirements</button>
    </fieldset><p className="mt-3 text-sm text-slate-500">Published salary ranges are compared only in the same currency/period. Missing data stays unknown. Other requirements guide coaching; verify them with the employer.</p></section>
    <form onSubmit={research} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5"><label className="block font-medium">Official company/job links — one per line<textarea required disabled={busy} rows={4} value={urls} onChange={event => setUrls(event.target.value)} placeholder="https://company.example/careers/job-title" className={field} /></label><p className="text-sm text-slate-600">Up to five links. Each uses AI and embedding requests. Public readable HTML only; a company homepage may not publish its stack or job requirements.</p><button disabled={busy} className="rounded bg-violet-700 px-4 py-2 text-white">{busy ? "Researching companies..." : "Build my shortlist"}</button></form>
    {progress && <p role="status" className="rounded bg-violet-50 p-3 text-violet-900">{progress}</p>}
    {error && <p role="alert" className="whitespace-pre-wrap rounded bg-red-50 p-3 text-red-800">{error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Shortlist ({shortlist.length})</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hideMismatches} onChange={event => setHideMismatches(event.target.checked)} />Hide explicit preference mismatches</label></div>
    <p className="text-sm text-slate-600">Sorted by fewer verified preference mismatches, then CV similarity. Unknown requirements remain provisional; no opening, salary, or certification acceptance is guaranteed.</p>
    {shortlist.map(report => <CompanyReportCard key={report.id} report={report} onDelete={() => void remove(report.id)} />)}
    {!shortlist.length && <p className="rounded border border-slate-200 bg-white p-5">No reports yet, or all were filtered. Add employer links above.</p>}
  </div>;
}
