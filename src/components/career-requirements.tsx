"use client";
import { useState, type FormEvent } from "react";
import { preferencesSchema, type CareerPreferences } from "@/lib/company/schema";

const field = "mt-1 w-full rounded border border-slate-300 bg-white p-2";
export function CareerRequirements({ initial, onSaved }: { initial: CareerPreferences; onSaved: (value: CareerPreferences) => void }) {
  const [preferences, setPreferences] = useState(initial);
  const [locations, setLocations] = useState(initial.locations.join(", "));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  function update<K extends keyof CareerPreferences>(key: K, value: CareerPreferences[K]) {
    setPreferences(current => ({ ...current, [key]: value })); setMessage("");
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const parsed = preferencesSchema.safeParse({ ...preferences, locations: locations.split(",").map(value => value.trim()).filter(Boolean) });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || "Check your requirements.");
      const response = await fetch("/api/career-preferences", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save requirements.");
      const saved = preferencesSchema.parse(data);
      setPreferences(saved); onSaved(saved); setMessage("Requirements saved. Job recommendations update automatically when you have a CV.");
    } catch (error) { setError(error instanceof Error ? error.message : "Save failed."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={save} className="rounded-xl border border-slate-200 bg-white p-5">
    <h2 className="mb-4 text-xl font-semibold">Your requirements</h2>
    <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <label>Target role<input required minLength={2} maxLength={150} value={preferences.target_role} onChange={e => update("target_role", e.target.value)} className={field} /></label>
      <label>Preferred locations (comma-separated)<input value={locations} onChange={e => { setLocations(e.target.value); setMessage(""); }} placeholder="Colombo, Kandy" className={field} /></label>
      <label>Work mode<select value={preferences.work_mode} onChange={e => update("work_mode", e.target.value as CareerPreferences["work_mode"])} className={field}>{["Any", "Remote", "Hybrid", "On-site"].map(value => <option key={value}>{value}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3"><label>Currency<select value={preferences.currency} onChange={e => update("currency", e.target.value as CareerPreferences["currency"])} className={field}>{["LKR", "USD", "INR", "EUR", "GBP", "AUD", "CAD"].map(value => <option key={value}>{value}</option>)}</select></label><label>Salary period<select value={preferences.salary_period} onChange={e => update("salary_period", e.target.value as CareerPreferences["salary_period"])} className={field}>{["monthly", "yearly", "hourly"].map(value => <option key={value}>{value}</option>)}</select></label></div>
      <label>Minimum salary (optional)<input type="number" min={0} step="any" value={preferences.salary_min ?? ""} onChange={e => update("salary_min", e.target.value === "" ? null : Number(e.target.value))} className={field} /></label>
      <label>Maximum salary (optional)<input type="number" min={0} step="any" value={preferences.salary_max ?? ""} onChange={e => update("salary_max", e.target.value === "" ? null : Number(e.target.value))} className={field} /></label>
      <label className="sm:col-span-2">Other requirements<textarea maxLength={2000} rows={2} value={preferences.notes} onChange={e => update("notes", e.target.value)} className={field} /></label>
      <button className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50 sm:col-span-2">{busy ? "Saving..." : "Save requirements"}</button>
    </fieldset>
    <p className="mt-3 text-sm text-slate-500">Job ranking uses your target role, all preferred locations and work mode. Salary is compared only when currency and period match. Missing values stay unknown. Other requirements guide company coaching; they are not automatically verified.</p>
    {error && <p role="alert" className="mt-3 text-red-700">{error}</p>}
    {message && <p role="status" className="mt-3 text-emerald-700">{message}</p>}
  </form>;
}
