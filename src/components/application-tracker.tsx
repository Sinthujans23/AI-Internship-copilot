"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { applicationStatuses, type ApplicationRow } from "@/lib/applications";
import { ApplicationMatch } from "@/components/application-match";

const fieldClass = "mt-1 w-full rounded border border-slate-300 bg-white p-2";

export function ApplicationTracker({ initialApplications, initialError }: {
  initialApplications: ApplicationRow[];
  initialError: string;
}) {
  const router = useRouter();
  const [applications, setApplications] = useState(initialApplications);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  // All writes go through authenticated API routes and database RLS.
  async function request(path: string, method: string, body?: unknown) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await response.json();
    if (response.status === 401) {
      router.replace("/login");
      router.refresh();
    }
    if (!response.ok) throw new Error(data.error || "Could not save your changes.");
    return data;
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const application: ApplicationRow = await request("/api/applications", "POST", {
        company: values.get("company"), role: values.get("role"),
        status: values.get("status"), job_text: values.get("job_text"),
      });
      setApplications(current => [application, ...current]);
      form.reset();
      setMessage("Application added.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not add application.");
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(id: string, status: ApplicationRow["status"]) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const updated: ApplicationRow = await request("/api/applications", "PATCH", { id, status });
      // Update the screen only after Supabase confirms the write.
      setApplications(current => current.map(row => row.id === id ? updated : row));
      setMessage("Status saved.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not change status.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this application?")) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await request(`/api/applications?id=${encodeURIComponent(id)}`, "DELETE");
      setApplications(current => current.filter(row => row.id !== id));
      setMessage("Application deleted.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not delete application.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <h1 className="mb-2 text-3xl font-bold">Your applications</h1>
    <p className="mb-6 text-slate-600">Add a job application and keep its status up to date.</p>
    {error && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-red-800">{error}</p>}
    {message && <p role="status" className="mb-4 rounded bg-green-50 p-3 text-green-800">{message}</p>}
    <section className="mb-8 rounded-xl border border-slate-200 bg-white p-5" aria-labelledby="add-heading">
      <h2 id="add-heading" className="mb-4 text-xl font-semibold">Add an application</h2>
      <form onSubmit={add}>
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
          <label>Company<input name="company" required maxLength={200} className={fieldClass} /></label>
          <label>Role<input name="role" required maxLength={200} className={fieldClass} /></label>
          <label>Status<select name="status" defaultValue="Applied" className={fieldClass}>{applicationStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
          <label className="sm:col-span-2">Job post (optional)<textarea name="job_text" rows={4} maxLength={20000} className={fieldClass} /></label>
          <button className="rounded bg-violet-700 px-4 py-2 text-white sm:col-span-2">{busy ? "Saving…" : "Add application"}</button>
        </fieldset>
      </form>
    </section>
    <section aria-labelledby="list-heading">
      <h2 id="list-heading" className="mb-4 text-xl font-semibold">All applications ({applications.length})</h2>
      {applications.length === 0 ? <p className="rounded border border-slate-200 bg-white p-6 text-slate-600">No applications yet. Add your first one above.</p> :
        <ul className="space-y-4">{applications.map(application => <li key={application.id} className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 break-words"><h3 className="text-lg font-semibold">{application.role}</h3><p>{application.company}</p><p className="mt-1 text-sm text-slate-600">Added {new Date(application.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Colombo" })}</p></div>
            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm">Status<select aria-label={`Status for ${application.role} at ${application.company}`} disabled={busy} value={application.status} onChange={event => void changeStatus(application.id, event.target.value as ApplicationRow["status"])} className={fieldClass}>{applicationStatuses.map(status => <option key={status}>{status}</option>)}</select></label>
              <button disabled={busy} aria-label={`Delete ${application.role} at ${application.company}`} onClick={() => void remove(application.id)} className="rounded border border-red-200 px-3 py-2 text-red-700">Delete</button>
            </div>
          </div>
          {application.job_text && <details className="mt-4"><summary className="cursor-pointer text-violet-700">View job post</summary><p className="mt-2 whitespace-pre-wrap break-words text-slate-600">{application.job_text}</p></details>}
          <ApplicationMatch id={application.id} initial={application.match_result} initialPreparation={application.agent_result} />
        </li>)}</ul>}
    </section>
  </>;
}
