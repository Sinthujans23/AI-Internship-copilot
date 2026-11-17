"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { InterviewSession } from "@/lib/career/schema";
import { CareerPicker, careerRequest, type CareerOptions } from "./career-picker";
type History = { sessions: InterviewSession[]; has_more: boolean };
export function InterviewDashboard({ options }: { options: CareerOptions }) {
  const params = useSearchParams(), initialJob = options.jobs.find(j => j.id === params.get("application"));
  const [cv, setCv] = useState(initialJob?.cv_id || options.cvs[0]?.id || ""), [job, setJob] = useState(initialJob?.id || "");
  const [session, setSession] = useState<InterviewSession | null>(null), [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [answers, setAnswers] = useState<string[]>(Array(5).fill("")), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [page, setPage] = useState(0), [more, setMore] = useState(false), [historyBusy, setHistoryBusy] = useState(false);
  const [requestId, setRequestId] = useState("");
  useEffect(() => { setRequestId(crypto.randomUUID()); }, []);
  useEffect(() => { let active = true; setHistoryBusy(true);
    careerRequest<History>(`/api/interviews?page=${page}`).then(h => { if (active) { setSessions(h.sessions); setMore(h.has_more); } }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setHistoryBusy(false); });
    return () => { active = false; };
  }, [page]);
  function open(row: InterviewSession) {
    if (session && !session.feedback && answers.some(Boolean) && !window.confirm("Discard the answers you have not submitted?")) return;
    setSession(row); setAnswers(row.answers || Array(5).fill("")); setError("");
  }
  async function start() {
    if (session && !session.feedback && answers.some(Boolean) && !window.confirm("Discard the answers you have not submitted?")) return;
    setBusy(true); setError("");
    try { const row = await careerRequest<InterviewSession>("/api/interviews", "POST", { action: "start", cv_id: cv, application_id: job, request_id: requestId });
      setSession(row); setAnswers(row.answers || Array(5).fill("")); setSessions(current => [row, ...current.filter(s => s.id !== row.id)].slice(0, 20)); setRequestId(crypto.randomUUID());
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  async function score() {
    setBusy(true); setError("");
    try { const row = await careerRequest<InterviewSession>("/api/interviews", "POST", { action: "score", id: session!.id, answers });
      setSession(row); setSessions(current => current.map(s => s.id === row.id ? row : s));
    } catch (e) { setError(String(e)); } finally { setBusy(false); }
  }
  return <div className="space-y-6"><h1 className="text-3xl font-bold">AI mock interview</h1>
    <p>Practise five questions based on your CV and a saved job. Feedback measures relevance, specificity and clarity. AI practice scores are guidance, not hiring predictions.</p>
    <section className="space-y-4 rounded-xl border bg-white p-5"><CareerPicker options={options} cv={cv} job={job} onCv={setCv} onJob={id => { setJob(id); const linked = options.jobs.find(j => j.id === id)?.cv_id; if (linked) setCv(linked); }} disabled={busy} />
      <button className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50" onClick={() => void start()} disabled={busy || !cv || !job || !requestId}>Start new practice</button></section>
    {busy && <p role="status">Preparing your questions or feedback…</p>}{error && <p role="alert" className="rounded bg-red-50 p-3">{error}</p>}
    {session && <section className="space-y-5 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{session.context.role} — {session.context.company}</h2><p className="text-sm">Source: {session.context.cv_name}. Saved {new Date(session.created_at).toLocaleString()}. This session uses the source snapshot from its creation.</p>
      {session.feedback && <p className="text-2xl font-bold">Practice score: {session.score}/100</p>}
      {!session.feedback && <p className="text-sm text-slate-600">Answer all five questions to get feedback. Answers are saved when you submit; unsent answers stay on this page.</p>}
      <form onSubmit={e => { e.preventDefault(); void score(); }} className="space-y-5">{session.questions.map((q, i) => <article key={`${session.id}-${i}`} className="space-y-2 border-b pb-4"><h3 className="font-semibold">{i + 1}. {q.question}</h3><p className="text-xs text-slate-500">{q.focus}</p>
        <label className="block">Your answer<textarea required minLength={1} maxLength={5000} rows={5} value={answers[i]} onChange={e => setAnswers(a => a.map((v, n) => n === i ? e.target.value : v))} disabled={busy || !!session.feedback} className="mt-1 block w-full rounded border p-3" /></label>
        {session.feedback && <div className="space-y-2 rounded bg-violet-50 p-3"><p>Relevance {session.feedback[i].relevance}/5 · Specificity {session.feedback[i].specificity}/5 · Clarity {session.feedback[i].clarity}/5</p><p><b>Strengths:</b> {session.feedback[i].strengths}</p><p><b>Improve:</b> {session.feedback[i].improvement}</p><p className="whitespace-pre-wrap"><b>Suggested outline:</b> {session.feedback[i].suggested_outline}</p></div>}
      </article>)}{!session.feedback && <button disabled={busy || answers.some(a => !a.trim())} className="rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50">Submit answers for feedback</button>}</form></section>}
    <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Session history</h2>{historyBusy ? <p role="status">Loading history…</p> : !sessions.length ? <p>No practice sessions yet.</p> : sessions.map(s => <button disabled={busy} key={s.id} onClick={() => open(s)} className="block w-full rounded border p-3 text-left">{s.context.role} — {s.context.company} · {new Date(s.created_at).toLocaleString()} · {s.score === null ? "Resume practice" : `${s.score}/100`}</button>)}<div className="flex gap-4"><button disabled={!page || historyBusy || busy} onClick={() => setPage(p => p - 1)}>Previous</button><span>Page {page + 1}</span><button disabled={!more || historyBusy || busy} onClick={() => setPage(p => p + 1)}>Next</button></div></section>
  </div>;
}
