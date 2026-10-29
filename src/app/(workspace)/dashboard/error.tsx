"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <div role="alert"><p>Your dashboard could not be loaded. Existing records have not changed.</p><button onClick={reset} className="rounded border p-2">Try again</button></div>;}
