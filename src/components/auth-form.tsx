"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseSetupMessage } from "@/lib/supabase/config";

export function AuthForm({ mode, errorCode }: { mode: "login" | "signup"; errorCode?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(errorCode === "confirmation");
  const signingUp = mode === "signup";
  const callbackError = errorCode === "configuration"
    ? supabaseSetupMessage
    : errorCode ? "Email confirmation failed. Please sign in or try the confirmation link again." : "";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const supabase = createClient();
      // Cookie-based sessions let server pages verify the signed-in user.
      const result = signingUp
        ? await supabase.auth.signUp({ email: email.trim(), password,
            options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` } })
        : await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (result.error) {
        if (result.error.code === "email_not_confirmed") setNeedsConfirmation(true);
        throw result.error;
      }
      if (!result.data.session) {
        setMessage("Check your email to confirm your account, then log in.");
        setNeedsConfirmation(true);
        return;
      }
      router.replace("/profile");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Authentication failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!email.trim()) { setError("Enter your signup email above first."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const { error } = await createClient().auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/api/auth/callback` } });
      if (error) throw error;
      setMessage("Confirmation requested. Check your inbox and spam folder; email rate limits may apply.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not resend confirmation."); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="mb-6 font-semibold text-violet-700">AI Internship Copilot</p>
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-2 text-2xl font-bold">{signingUp ? "Create an account" : "Log in"}</h1>
        <p className="mb-6 text-slate-600">Keep your internship applications in one place.</p>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">Email
            <input required type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" />
          </label>
          <label className="block">Password
            <input required minLength={signingUp ? 8 : undefined} type="password" autoComplete={signingUp ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} className="mt-1 w-full rounded border border-slate-300 p-2" />
          </label>
          {signingUp && <p className="text-sm text-slate-600">Use at least 8 characters.</p>}
          {(error || callbackError) && <p role="alert" className="text-red-700">{error || callbackError}</p>}
          {message && <p role="status" className="text-green-700">{message}</p>}
          <button disabled={busy} className="w-full rounded bg-violet-700 px-4 py-2 text-white disabled:opacity-50">{busy ? "Please wait…" : signingUp ? "Sign up" : "Log in"}</button>
        </form>
        {needsConfirmation && <div className="mt-4 space-y-3 rounded bg-violet-50 p-3"><p className="text-sm">Open the newest confirmation email on this computer, in the browser used to sign up. Keep this local server running. Expired links need a new email.</p><button disabled={busy} type="button" onClick={() => void resendConfirmation()} className="rounded border border-violet-300 px-3 py-2 text-violet-800">Resend confirmation email</button></div>}
        <p className="mt-6">{signingUp ? "Already registered? " : "New here? "}<Link className="text-violet-700 underline" href={signingUp ? "/login" : "/signup"}>{signingUp ? "Log in" : "Sign up"}</Link></p>
      </div>
    </main>
  );
}
