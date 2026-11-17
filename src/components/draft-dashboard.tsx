"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { DraftPack, DraftContent } from "@/lib/career/schema";
import { CareerPicker, careerRequest, downloadText, type CareerOptions } from "./career-picker";
import { CopyButton } from "./copy-button";
const labels: Record<keyof DraftContent, string> = { cover_letter: "Cover letter", application_email: "Application email", follow_up: "Follow-up email" };
export function DraftDashboard({ options }: { options: CareerOptions }) {
  const params = useSearchParams(), initialJob = options.jobs.find(j => j.id === params.get("application"));
  const [cv, setCv] = useState(initialJob?.cv_id || options.cvs[0]?.id || ""), [job, setJob] = useState(initialJob?.id || "");
  const [pack, setPack] = useState<DraftPack | null>(null), [content, setContent] = useState<DraftContent | null>(null), [packs, setPacks] = useState<DraftPack[]>([]);
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [historyBusy, setHistoryBusy] = useState(false);
  const dirty = !!pack && JSON.stringify(content) !== JSON.stringify(pack.content);
  useEffect(() => { let active = true; setHistoryBusy(true);
    careerRequest<{ packs: DraftPack[]; has_more: boolean }>(`/api/drafts?page=${page}`).then(h => { if (active) { setPacks(h.packs); setMore(h.has_more); } }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setHistoryBusy(false); }); return () => { active = false; };
  }, [page]);
  function open(p: DraftPack) { if (dirty && !window.confirm("Discard unsaved draft edits?")) return; setPack(p); setContent(p.content); setNotice(""); }
  async function generate() {
    if (dirty && !window.confirm("Discard unsaved draft edits?")) return;
    setBusy(true); setError(""); setNotice("");
    try { const p = await careerRequest<DraftPack>("/api/drafts", "POST", { cv_id: cv, application_id: job }); setPack(p); setContent(p.content); setPacks(current => [p, ...current.filter(v => v.id !== p.id)].slice(0, 20)); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError(""); setNotice("");
    try { const p = await careerRequest<DraftPack>("/api/drafts", "PATCH", { id: pack!.id, updated_at: pack!.updated_at, content }); setPack(p); setContent(p.content); setPacks(rows => rows.map(row => row.id === p.id ? p : row)); setNotice("Edits saved."); }
    catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><h1 className="text-3xl font-bold">Application draft pack</h1><p>Create and edit a cover letter, application email and follow-up. Check facts and replace placeholders before using them. Follow-up drafts are for use after applying.</p>
    <section className="space-y-4 rounded-xl border bg-white p-5"><CareerPicker options={options} cv={cv} job={job} onCv={setCv} onJob={id => { setJob(id); const linked = options.jobs.find(j => j.id === id)?.cv_id; if (linked) setCv(linked); }} disabled={busy} /><button onClick={() => void generate()} disabled={busy || !cv || !job} className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50">Generate draft pack</button></section>
    {busy && <p role="status">Working on your drafts…</p>}{error && <p role="alert" className="rounded bg-red-50 p-3">{error}</p>}{notice && <p role="status">{notice}</p>}
    {pack && content && <section className="space-y-5 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{pack.context.role} — {pack.context.company}</h2><p className="text-sm">Based on {pack.context.cv_name}. Saved source snapshot: {new Date(pack.created_at).toLocaleString()}.</p>
      <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-5">{(Object.keys(labels) as (keyof DraftContent)[]).map(key => <div key={key} className="space-y-2"><label className="block font-semibold">{labels[key]}<textarea rows={10} required maxLength={4000} value={content[key]} disabled={busy} onChange={e => setContent({ ...content, [key]: e.target.value })} className="mt-2 block w-full rounded border p-3 font-normal" /></label><div className="flex gap-4"><CopyButton text={content[key]} label={`Copy ${labels[key].toLowerCase()}`} /><button type="button" onClick={() => downloadText(content[key], `${key}.txt`)}>Download .txt</button></div></div>)}<button disabled={busy || !dirty} className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50">Save edits</button>{dirty && <p role="status">You have unsaved edits.</p>}</form>
    </section>}
    <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Saved draft packs</h2>{historyBusy ? <p role="status">Loading history…</p> : packs.length ? packs.map(p => <button key={p.id} disabled={busy} onClick={() => open(p)} className="block w-full rounded border p-3 text-left">{p.context.role} — {p.context.company} · {new Date(p.created_at).toLocaleString()}</button>) : <p>No saved drafts yet.</p>}<div className="flex gap-4"><button disabled={!page || busy || historyBusy} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={!more || busy || historyBusy} onClick={() => setPage(p => p + 1)}>Next</button></div></section>
  </div>;
}
