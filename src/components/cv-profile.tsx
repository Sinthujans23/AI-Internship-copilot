"use client";
import { useState, type FormEvent } from "react";
import type { Database } from "@/types/database";
import Link from "next/link";

type Cv = Database["public"]["Tables"]["cvs"]["Row"];
export function CvProfile({ initialCvs, initialError }: { initialCvs: Cv[]; initialError: string }) {
  const [cvs, setCvs] = useState(initialCvs);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const current = cvs[0];
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget;
    const body = new FormData(form);
    if (current) body.set("replace_id", current.id);
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/cvs", { method: "POST", body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Upload failed.");
      setCvs(previous => [data.cv, ...previous.filter(cv => cv.id !== current?.id || data.warning)]);
      setMessage(data.warning || "CV saved. Your newest CV will be used for matching."); form.reset();
    } catch (error) { setError(error instanceof Error ? error.message : "Upload failed."); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm("Delete this CV and its PDF file?")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/cvs/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Delete failed.");
      setCvs(previous => previous.filter(cv => cv.id !== id));
    } catch (error) { setError(error instanceof Error ? error.message : "Delete failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6">
    <div><h1 className="text-3xl font-bold">Your CV profile</h1><p className="mt-2 text-slate-600">Upload a text-based PDF up to 4 MB. Your newest CV is used for matching.</p></div>
    <form onSubmit={upload} className="space-y-4 rounded-xl border bg-white p-5">
      <label className="block">CV PDF<input required disabled={busy} name="file" type="file" accept="application/pdf,.pdf" className="mt-2 block w-full rounded border p-2" /></label>
      <button disabled={busy} className="rounded bg-violet-700 px-4 py-2 text-white">{busy ? "Processing PDF..." : current ? "Replace current CV" : "Upload CV"}</button>
    </form>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="rounded bg-green-50 p-3 text-green-800">{message}</p>}
    {!cvs.length && <p>No CV yet. Upload one to get started.</p>}
    {cvs.map((cv, index) => <section key={cv.id} className="space-y-4 rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="break-all text-lg font-semibold">{cv.file_name} {index === 0 && <span className="text-sm text-violet-700">(Current)</span>}</h2><button disabled={busy} onClick={() => void remove(cv.id)} className="rounded border border-red-200 px-3 py-2 text-red-700">Delete CV</button></div>
      <div className="flex flex-wrap gap-2">{cv.skills.map(skill => <span key={skill} className="rounded-full bg-violet-50 px-3 py-1 text-sm text-violet-800">{skill}</span>)}</div>
      <div className="flex flex-wrap gap-4 text-sm"><Link href={`/profile/pdf?cv_id=${encodeURIComponent(cv.id)}`} className="text-violet-700 underline">Edit original PDF layout</Link><a href={`/api/cvs/download?cv_id=${encodeURIComponent(cv.id)}`} className="text-violet-700 underline">Download PDF</a></div>
      {!cv.skills.length && <p className="text-slate-600">No skills recognized by the initial vocabulary. Your full CV text is still available for matching.</p>}
      <details open={index === 0}><summary className="cursor-pointer font-medium">Extracted text</summary><pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap break-words rounded bg-slate-50 p-3 font-sans">{cv.extracted_text}</pre></details>
    </section>)}
  </div>;
}
