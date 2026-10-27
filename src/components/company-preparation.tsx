import type { CompanyReport } from "@/lib/company/schema";
import { CopyButton } from "./copy-button";

// Older saved reports lack these fields; they remain readable until rerun.
export function CompanyRequirements({ report }: { report: CompanyReport }) {
  const groups = [
    { title: "Other published requirements", facts: report.facts.requirements || [] },
    { title: "Responsibilities", facts: report.facts.responsibilities || [] },
    { title: "Official application instructions", facts: report.facts.application_instructions || [] },
  ];
  return <section className="space-y-4 rounded border p-4"><h3 className="text-lg font-semibold">What the company expects</h3>
    {report.facts.scope !== "job_post" && <p className="text-sm text-amber-800">These pages do not verify an opening for your role. Use a direct vacancy link for specific requirements.</p>}
    {groups.map(group => <div key={group.title}><h4 className="font-semibold">{group.title}</h4>{group.facts.length ? <ul className="mt-2 space-y-3">{group.facts.map((fact, i) => <li key={i} className="rounded bg-slate-50 p-3"><p>{fact.value}</p><details className="mt-1 text-sm"><summary>Published evidence</summary><blockquote className="my-2 border-l-2 pl-3">{fact.quote}</blockquote>{report.sources[fact.source_index] && <a className="text-violet-700 underline" href={report.sources[fact.source_index].url} target="_blank" rel="noreferrer">Read source</a>}</details></li>)}</ul> : <p className="text-sm text-slate-600">Not verified in this report. Check the official vacancy or rerun with its link.</p>}</div>)}
  </section>;
}

export function CompanyPreparation({ report }: { report: CompanyReport }) {
  const coaching = report.coaching;
  const prep = coaching.interview_preparation;
  if (!prep) return <p className="rounded bg-violet-50 p-3 text-sm">This is an older report. Analyze the company link again to add the expanded requirements, CV additions and interview preparation.</p>;
  return <div className="space-y-4">
    <section className="rounded border p-4"><h3 className="text-lg font-semibold">What to add to your CV</h3><p className="mt-1 text-sm text-slate-600">Add these only when you have the stated evidence. Learning goals belong in your plan until completed.</p><div className="mt-3 space-y-3">{coaching.cv_additions?.length ? coaching.cv_additions.map((item, i) => <div key={i} className="rounded bg-slate-50 p-3"><h4 className="font-semibold">{item.section}</h4><p>{item.suggestion}</p><p className="mt-2 text-sm"><b>Evidence needed:</b> {item.evidence_needed}</p></div>) : <p>No additional CV sections were suggested.</p>}</div></section>
    <section className="rounded border p-4"><h3 className="text-lg font-semibold">Before you apply or email your CV</h3><ol className="mt-3 list-decimal space-y-2 pl-5">{coaching.application_checklist?.map((item, i) => <li key={i}>{item}</li>)}</ol><p className="mt-3 text-sm text-slate-600">Follow the verified channel above. If none was found, verify it on the official careers page before sending.</p></section>
    <section className="space-y-4 rounded border p-4"><h3 className="text-lg font-semibold">How to speak in the interview</h3><p className="text-sm text-slate-600">Practice suggestions based on your target role and available evidence; these are not confirmed company interview questions.</p>
      <div><h4 className="font-semibold">Prepare your introduction</h4><ol className="mt-2 list-decimal space-y-2 pl-5">{prep.introduction_outline.map((item, i) => <li key={i}>{item}</li>)}</ol></div>
      <div><h4 className="font-semibold">Questions to practise</h4><div className="mt-2 space-y-3">{prep.practice_questions.map((item, i) => <div key={i} className="rounded bg-slate-50 p-3"><h5 className="font-semibold">{item.question}</h5><p className="mt-1 text-sm text-slate-600">{item.why_practice}</p><ol className="mt-2 list-decimal space-y-1 pl-5">{item.answer_outline.map((line, j) => <li key={j}>{line}</li>)}</ol></div>)}</div></div>
      <div><h4 className="font-semibold">Questions you can ask the interviewer</h4><ul className="my-2 list-disc space-y-2 pl-5">{prep.questions_to_ask.map((item, i) => <li key={i}>{item}</li>)}</ul><CopyButton text={prep.questions_to_ask.join("\n")} label="Copy my questions" /></div>
    </section>
  </div>;
}
