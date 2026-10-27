"use client";
import { useState } from "react";
import type { SkillMatch } from "@/lib/matching-schema";

export function ApplicationMatch({ id, initial }: { id: string; initial: SkillMatch | null }) {
  const [match, setMatch] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function calculate() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ application_id: id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Matching failed.");
      setMatch(data);
    } catch (error) { setError(error instanceof Error ? error.message : "Matching failed."); }
    finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-3 border-t pt-4">
    <button disabled={busy} onClick={() => void calculate()} className="rounded border border-violet-300 px-3 py-2 text-violet-800">{busy ? "Matching..." : "Check CV match"}</button>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {match && <div className="space-y-2"><p className="text-2xl font-bold text-violet-800">{match.score}/100</p><p className="text-sm text-slate-600">Estimated skill similarity; not a hiring prediction.</p><p>Matched: {match.matched_skills.join(", ") || "None"}</p><p>Missing: {match.missing_skills.join(", ") || "None detected"}</p></div>}
  </div>;
}
