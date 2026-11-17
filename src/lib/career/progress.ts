import type { ApplicationRow } from "@/lib/applications";
export function progressTrends(rows: Pick<ApplicationRow, "id" | "application_date" | "status">[], history: { application_id: string; new_status: string; old_status: string | null }[], today: string) {
  const end = new Date(`${today}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - (8 - i) * 7);
    const finish = new Date(start); finish.setUTCDate(finish.getUTCDate() + 7);
    const date = start.toISOString().slice(0, 10), until = finish.toISOString().slice(0, 10);
    return { start: date, end: until, count: rows.filter(r => r.application_date && r.application_date >= date && r.application_date < until).length };
  });
  const cohort = rows.filter(r => r.application_date && r.application_date >= weeks[0].start && r.application_date < end.toISOString().slice(0, 10));
  const interviewed = new Set(history.filter(h => [h.new_status, h.old_status].some(s => s === "Interview" || s === "Offer")).map(h => h.application_id));
  const converted = cohort.filter(r => interviewed.has(r.id) || ["Interview", "Offer"].includes(r.status)).length;
  return { weeks, cohort: cohort.length, converted, conversion: cohort.length ? Math.round(converted / cohort.length * 100) : null };
}
export function recurringGaps(jobs: { id: string; required: string[] }[]) {
  const counts = new Map<string, { skill: string; count: number }>();
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.id)) continue; seen.add(job.id);
    for (const skill of new Set(job.required.map(s => s.trim().toLowerCase()).filter(Boolean))) {
      const entry = counts.get(skill) || { skill, count: 0 }; entry.count++; counts.set(skill, entry);
    }
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill)).slice(0, 10);
}
