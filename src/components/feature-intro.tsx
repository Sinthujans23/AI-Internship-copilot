import { Sparkles } from "lucide-react";

export function FeatureIntro({ children }: { children: string }) {
  return (
    <aside className="flex items-start gap-3 rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 via-white to-indigo-50 p-4 sm:p-5">
      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-white text-violet-700 shadow-sm">
        <Sparkles aria-hidden="true" size={18} />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-violet-700">Start here</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{children}</p>
      </div>
    </aside>
  );
}
