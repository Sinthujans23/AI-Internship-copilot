import Link from "next/link";
import { logout } from "@/app/logout/actions";

export function AppShell({ children, email }: { children: React.ReactNode; email: string }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <Link href="/profile" className="text-lg font-bold text-violet-700">AI Internship Copilot</Link>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/profile" className="text-violet-700 underline">CV profile</Link>
            <Link href="/jobs" className="text-violet-700 underline">Find jobs</Link>
            <Link href="/companies" className="text-violet-700 underline">Company shortlist</Link>
            <span className="break-all text-sm text-slate-600">{email}</span>
            {/* A server action clears cookies before redirecting to login. */}
            <form action={logout}><button className="rounded border border-slate-300 px-3 py-2">Log out</button></form>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
