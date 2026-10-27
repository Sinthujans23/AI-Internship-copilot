"use client";
import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [message, setMessage] = useState("");
  async function copy() {
    try { await navigator.clipboard.writeText(text); setMessage("Copied"); }
    catch { setMessage("Select and copy the text manually."); }
  }
  return <span className="inline-flex flex-wrap items-center gap-2"><button type="button" onClick={() => void copy()} className="rounded border border-slate-300 bg-white px-3 py-1 text-sm">{label}</button><span role="status" className="text-sm text-slate-600">{message}</span></span>;
}
