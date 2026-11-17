"use client";
export type CareerOptions = { cvs: { id: string; file_name: string }[]; jobs: { id: string; company: string; role: string; cv_id: string | null }[]; error: string };
export function CareerPicker({ options, cv, job, onCv, onJob, disabled }: { options: CareerOptions; cv: string; job: string; onCv: (id: string) => void; onJob: (id: string) => void; disabled: boolean }) {
  return <div className="grid gap-4 sm:grid-cols-2">
    <label>CV version<select className="mt-1 block w-full rounded border p-2" value={cv} onChange={e => onCv(e.target.value)} disabled={disabled}><option value="">Choose CV</option>{options.cvs.map(c => <option key={c.id} value={c.id}>{c.file_name}</option>)}</select></label>
    <label>Saved application<select className="mt-1 block w-full rounded border p-2" value={job} onChange={e => onJob(e.target.value)} disabled={disabled}><option value="">Choose application</option>{options.jobs.map(j => <option key={j.id} value={j.id}>{j.role} — {j.company}</option>)}</select></label>
    {options.error && <p role="alert">{options.error}</p>}
    {(!options.cvs.length || !options.jobs.length) && <p>Upload a CV in CV Profile and save an application with a job description in Applications first.</p>}
  </div>;
}
export async function careerRequest<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || "Request failed. Please retry."); return data;
}
export function downloadText(text: string, filename: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type })); const a = document.createElement("a");
  a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
