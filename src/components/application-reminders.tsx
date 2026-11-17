"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { applicationReminders, calendarDay, remindersCalendar, type ReminderApplication } from "@/lib/career/reminders";
import { downloadText } from "./career-picker";
export function ApplicationReminders({ rows }: { rows: ReminderApplication[] }) {
  const [today, setToday] = useState(() => calendarDay());
  useEffect(() => { const update = () => setToday(calendarDay(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone)); update(); const timer = setInterval(update, 60000); return () => clearInterval(timer); }, []);
  const reminders = applicationReminders(rows, today), upcoming = reminders.filter(r => !r.overdue), overdue = reminders.filter(r => r.overdue);
  const visible = [...overdue.slice(0, 3), ...upcoming.slice(0, 5)];
  return <section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">Deadlines & follow-ups</h2>
    <p className="text-sm">{overdue.length} overdue · {upcoming.length} upcoming. Dates use your local calendar day. Update completed dates in the tracker. Reminders appear here when you open the app.</p>
    {reminders.length ? <><ul className="space-y-2">{visible.map(r => <li key={r.id} className={`rounded p-3 ${r.overdue ? "bg-amber-50" : "bg-violet-50"}`}><Link href="/applications" className="underline">{r.title}</Link><p className="text-sm"><time dateTime={r.date}>{r.date}</time> · {r.overdue ? "Overdue" : r.date === today ? "Today" : "Upcoming"}</p></li>)}</ul>{reminders.length > visible.length && <p>Showing {visible.length} of {reminders.length} (up to 3 overdue and 5 upcoming); all dates are included in the export.</p>}<button className="rounded border px-3 py-2" onClick={() => downloadText(remindersCalendar(reminders), "internship-reminders.ics", "text/calendar;charset=utf-8")}>Export calendar (.ics)</button><p className="text-xs text-slate-500">Calendar entries are all-day snapshots. Import into your calendar and set alerts there; re-export after changing dates.</p></> : <p>No active reminders. Add a deadline, interview or follow-up date in <Link href="/applications" className="underline">Applications</Link>.</p>}
  </section>;
}
