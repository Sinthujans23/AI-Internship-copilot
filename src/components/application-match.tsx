"use client";
import { useState } from "react";
import { matchSchema, type SkillMatch } from "@/lib/matching-schema";
import { preparationSchema, type Preparation } from "@/lib/agent-schema";
import { CopyButton } from "@/components/copy-button";
import { ScoreCard } from "@/components/score-card";

export function ApplicationMatch({ id, initial, initialPreparation, hasJob }: { id: string; initial: SkillMatch | null; initialPreparation: Preparation | null; hasJob: boolean }) {
  const parsedMatch = matchSchema.safeParse(initial);
  const parsedPreparation = preparationSchema.safeParse(initialPreparation);
  const [match, setMatch] = useState(parsedMatch.success ? parsedMatch.data : null);
  const [preparation, setPreparation] = useState(parsedPreparation.success ? parsedPreparation.data : null);
  const [busy, setBusy] = useState<"match" | "prepare" | null>(null);
  const [error, setError] = useState("");
  async function run(action: "match" | "prepare") {
    setBusy(action); setError("");
    try {
      const response = await fetch(action === "match" ? "/api/match" : "/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ application_id: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Preparation failed.");
      if (action === "prepare") {
        const result = preparationSchema.parse(data);
        setPreparation(result); setMatch(result.match);
      } else setMatch(matchSchema.parse(data));
    } catch (error) { setError(error instanceof Error ? error.message : "Request failed."); }
    finally { setBusy(null); }
  }
  return <div aria-busy={!!busy} className="mt-4 space-y-4 border-t border-slate-100 pt-4">
    <div className="flex flex-wrap gap-3">
      <button disabled={!!busy || !hasJob} onClick={() => void run("match")} className="rounded border border-violet-300 px-3 py-2 text-violet-800">{busy === "match" ? "Matching..." : "Check CV match"}</button>
      <button disabled={!!busy || !hasJob} onClick={() => void run("prepare")} className="rounded bg-violet-700 px-3 py-2 text-white">{busy === "prepare" ? "Preparing application..." : "Prepare my application"}</button>
    </div>
    {busy === "prepare" && <p role="status" className="text-sm text-slate-600">Reading the job and your CV, matching skills, and drafting materials. This may take a few minutes.</p>}
    {!hasJob && <p className="text-sm text-slate-600">Save a detailed job post through Analyze job to enable matching and preparation.</p>}
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {match && <ScoreCard match={match} />}
    {preparation && <section className="space-y-5">
      <p className="text-sm text-slate-600">Prepared using {preparation.cv_name} on {new Date(preparation.prepared_at).toLocaleString("en-GB", { timeZone: "Asia/Colombo" })}. Re-run after changing your CV.</p>
      <div><h4 className="mb-3 text-lg font-semibold">Tailored CV bullets</h4><ul className="space-y-3">{preparation.rewritten_bullets.map((bullet, index) => <li key={index} className="space-y-2 rounded border p-3"><p className="whitespace-pre-wrap">{bullet}</p><CopyButton text={bullet} label={`Copy bullet ${index + 1}`} /></li>)}</ul></div>
      <div className="space-y-3 rounded border p-4"><h4 className="text-lg font-semibold">Application email</h4><p className="font-medium">{preparation.email.subject}</p><p className="whitespace-pre-wrap">{preparation.email.body}</p><CopyButton text={`Subject: ${preparation.email.subject}\n\n${preparation.email.body}`} label="Copy email" /></div>
      <p className="text-sm text-slate-600">{preparation.summary}</p><p className="rounded bg-amber-50 p-3 text-sm text-amber-900">Review every claim and replace placeholders before applying. No email has been sent.</p>
    </section>}
  </div>;
}
