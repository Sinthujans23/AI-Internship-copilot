"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  BriefcaseBusiness,
  Building2,
  ChartNoAxesCombined,
  FileUser,
  Github,
  ListChecks,
  Search,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "Career readiness", icon: ChartNoAxesCombined },
  { href: "/profile", label: "CV profile", icon: FileUser },
  { href: "/tailoring", label: "Tailor your CV", icon: BriefcaseBusiness },
  { href: "/jobs", label: "Find jobs", icon: Search },
  { href: "/applications", label: "Applications", icon: ListChecks },
  { href: "/companies", label: "Company research", icon: Building2 },
  { href: "/github", label: "GitHub insights", icon: Github },
  { href: "/learning", label: "Learning roadmap", icon: BookOpen },
];

export function WorkspaceNav() {
  const pathname = usePathname();

  return (
    <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <nav aria-label="Workspace features" className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
        <div className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors lg:w-full ${
                  active
                    ? "bg-violet-50 text-violet-800"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon aria-hidden="true" size={18} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="mt-4 hidden rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-700 p-4 text-white lg:block">
        <p className="text-sm font-semibold">One step at a time</p>
        <p className="mt-1 text-xs leading-5 text-violet-100">Build your profile, discover opportunities, and keep your progress together.</p>
      </div>
    </aside>
  );
}
