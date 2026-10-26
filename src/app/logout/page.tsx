import Link from "next/link";
import { logout } from "./actions";

export default async function LogoutPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <main className="mx-auto max-w-md space-y-4 p-8">
    <h1 className="text-2xl font-bold">Log out</h1>
    {error && <p role="alert" className="text-red-700">Could not log out. Please try again.</p>}
    <p>Log out of AI Internship Copilot on this browser.</p>
    <form action={logout}><button className="rounded bg-violet-700 px-4 py-2 text-white">Log out</button></form>
    <Link href="/dashboard" className="block text-violet-700 underline">Back to dashboard</Link>
  </main>;
}
