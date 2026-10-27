export function SkillChips({ skills, kind = "neutral" }: { skills: string[]; kind?: "neutral" | "matched" | "missing" }) {
  const colors = { neutral: "bg-violet-50 text-violet-800", matched: "bg-emerald-50 text-emerald-800", missing: "bg-amber-50 text-amber-900" };
  return skills.length ? <ul className="flex flex-wrap gap-2">{skills.map((skill, index) => <li key={`${skill}-${index}`} className={`rounded-full px-3 py-1 text-sm ${colors[kind]}`}>{skill}</li>)}</ul> : <p className="text-sm text-slate-500">None listed.</p>;
}
