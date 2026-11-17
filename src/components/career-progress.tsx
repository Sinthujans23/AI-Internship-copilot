"use client";
import Link from "next/link";
import type { CareerProgressData } from "@/lib/career/progress-service";
import { recurringGaps } from "@/lib/career/progress";
import { ApplicationReminders } from "./application-reminders";
export function CareerProgress({ data, jobs }: { data: CareerProgressData; jobs: { id: string; required: string[] }[] }) {
  const gaps = recurringGaps(jobs);
  return <div className="space-y-5">{data.warnings.map(w => <p key={w} role="alert" className="rounded bg-amber-50 p-3">{w}</p>)}
    {data.applications && <ApplicationReminders rows={data.applications} />}
    <section className="space-y-4 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Your progress over eight weeks</h2>
      {data.trends ? <><div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="pb-3 text-left">Applications per seven-day period, based on the application date you entered (Sri Lanka calendar days).</caption><thead><tr><th scope="col">Week starting</th><th scope="col">Applications</th><th scope="col">Activity</th></tr></thead><tbody>{data.trends.weeks.map(w => <tr key={w.start}><th scope="row" className="py-2 font-normal">{w.start}</th><td>{w.count}</td><td><meter min={0} max={Math.max(1, ...data.trends!.weeks.map(v => v.count))} value={w.count} aria-label={`${w.count} applications from ${w.start}`} className="w-full" /></td></tr>)}</tbody></table></div><p><b>Interview conversion:</b> {data.trends.conversion === null ? "No dated applications in this period" : `${data.trends.conversion}% (${data.trends.converted}/${data.trends.cohort})`}</p><p className="text-xs text-slate-500">Share of applications dated in these eight weeks that reached Interview or Offer in recorded history or current stage. Earlier unrecorded transitions and deleted applications are excluded. This is a cohort rate, not an outcome prediction.</p></> : <p>Weekly trends and conversion are unavailable.</p>}
      <p><b>Learning tasks completed:</b> {data.learning ? `${data.learning.completed}/${data.learning.total} across all saved roadmaps` : "Unavailable"}. Completion is self-reported; roadmap versions may contain repeated tasks.</p>
      <h3 className="font-semibold">Recurring required skill gaps</h3>{gaps.length ? <ul className="list-disc pl-5">{gaps.map(g => <li key={g.skill}>{g.skill}: missing from {g.count} saved {g.count === 1 ? "listing" : "listings"}</li>)}</ul> : <p>No required gaps recognized in current-CV match snapshots.</p>}<p className="text-xs text-slate-500">Based on distinct jobs from the latest three match snapshots for your current CV. A missing CV mention does not prove you lack the skill.</p>
      <Link href="/learning" className="inline-block underline">Continue learning</Link>
    </section>
  </div>;
}
