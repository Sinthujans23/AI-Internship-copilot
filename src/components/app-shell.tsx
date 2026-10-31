import Link from "next/link";
import { logout } from "@/app/logout/actions";
import { WorkspaceNav } from "@/components/workspace-nav";

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-violet-700 text-sm font-bold text-white">AI</span>
            <span>
              <span className="block text-base font-bold tracking-tight text-slate-900">Internship Copilot</span>
              <span className="block text-xs text-slate-500">Your career workspace</span>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span title={email} className="hidden max-w-56 truncate text-sm text-slate-600 sm:block">{email}</span>
            <form action={logout}>
              <button className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Log out</button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-screen-2xl gap-6 px-4 py-5 sm:px-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-8 lg:px-8 lg:py-8">
        <WorkspaceNav />
        <main className="min-w-0 space-y-6">{children}</main>
      </div>
    </div>
  );
}
