import { SkillChips } from "@/components/skill-chips";
import type { SkillMatch } from "@/lib/matching-schema";

export function ScoreCard({ match }: { match: SkillMatch }) {
  return <section aria-label="CV match result" className="space-y-4 rounded-xl border border-violet-100 bg-white p-5">
    <div className="flex flex-wrap items-end justify-between gap-2"><h4 className="font-semibold">CV skill match</h4><p className="text-3xl font-bold text-violet-800">{match.score}<span className="text-base text-slate-500">/100</span></p></div>
    <div role="meter" aria-label="Skill similarity" aria-valuemin={0} aria-valuemax={100} aria-valuenow={match.score} className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${match.score}%` }} /></div>
    <p className="text-sm text-slate-500">Embedding similarity estimate; this does not predict an interview or offer.</p>
    <div><h5 className="mb-2 font-medium">Matched skills</h5><SkillChips skills={match.matched_skills} kind="matched" /></div>
    <div><h5 className="mb-2 font-medium">Missing skills</h5><SkillChips skills={match.missing_skills} kind="missing" /></div>
  </section>;
}
