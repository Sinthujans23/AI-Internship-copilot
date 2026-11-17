import type { ApplicationRow } from "@/lib/applications";
export type Reminder = { id: string; application_id: string; date: string; title: string; kind: "Deadline" | "Interview" | "Follow-up"; overdue: boolean };
export function calendarDay(now = new Date(), timeZone = "Asia/Colombo") {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export type ReminderApplication = Pick<ApplicationRow, "id" | "company" | "role" | "status" | "deadline_date" | "interview_date" | "follow_up_date">;
export function applicationReminders(rows: ReminderApplication[], today: string): Reminder[] {
  return rows.filter(r => !["Offer", "Rejected", "Withdrawn"].includes(r.status)).flatMap(r => {
    const dates = [
      { kind: "Deadline" as const, date: r.status === "Saved" ? r.deadline_date : null },
      { kind: "Interview" as const, date: r.interview_date },
      { kind: "Follow-up" as const, date: r.follow_up_date },
    ];
    return dates.filter((d): d is typeof d & { date: string } => Boolean(d.date)).map(d => ({
      id: `${r.id}-${d.kind}`, application_id: r.id, date: d.date, kind: d.kind,
      title: `${d.kind}: ${r.role} at ${r.company}`, overdue: d.date < today,
    }));
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}
const escapeIcs = (s: string) => s.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
function foldLine(line: string) {
  const lines: string[] = []; let chunk = ""; let size = 0;
  for (const char of line) {
    const bytes = new TextEncoder().encode(char).length;
    if (size + bytes > 75) { lines.push(chunk); chunk = " "; size = 1; }
    chunk += char; size += bytes;
  }
  lines.push(chunk); return lines.join("\r\n");
}
export function remindersCalendar(reminders: Reminder[], now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Internship Copilot//Reminders//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH"];
  for (const r of reminders) {
    const end = new Date(`${r.date}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
    lines.push("BEGIN:VEVENT", `UID:${r.id}@internship-copilot`, `DTSTAMP:${now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
      `DTSTART;VALUE=DATE:${r.date.replace(/-/g, "")}`, `DTEND;VALUE=DATE:${end.toISOString().slice(0, 10).replace(/-/g, "")}`,
      `SUMMARY:${escapeIcs(r.title)}`, "DESCRIPTION:Review the saved application in Internship Copilot. Dates are all-day; verify the actual interview time.", "END:VEVENT");
  }
  return [...lines, "END:VCALENDAR"].map(foldLine).join("\r\n") + "\r\n";
}
