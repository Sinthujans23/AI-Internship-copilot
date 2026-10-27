"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { pdfPageSchema, pdfEditsSchema, type PdfEdit, type PdfPage } from "@/lib/pdf-editor-schema";

const fonts = { helv: "Helvetica", hebo: "Helvetica bold", heit: "Helvetica italic", tiro: "Times", tibo: "Times bold", cour: "Courier" };
type Block = PdfPage["blocks"][number];
export function PdfEditor({ cvId, cvName, suggestions }: { cvId: string; cvName: string; suggestions: { original_quote: string; suggested_text: string; reason: string }[] }) {
  const [pageNumber, setPageNumber] = useState(0);
  const [page, setPage] = useState<PdfPage | null>(null);
  const [selected, setSelected] = useState<Block | null>(null);
  const [text, setText] = useState("");
  const [font, setFont] = useState<PdfEdit["font"]>("helv");
  const [fontSize, setFontSize] = useState(11);
  const [edits, setEdits] = useState<PdfEdit[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [saved, setSaved] = useState<{ id: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(""); setSelected(null); setPage(null);
    async function load() {
      try {
        const response = await fetch(`/api/cvs/pdf?cv_id=${encodeURIComponent(cvId)}&page=${pageNumber}`, { signal: controller.signal });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not load PDF page.");
        setPage(pdfPageSchema.parse(data));
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "PDF page failed."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load(); return () => controller.abort();
  }, [cvId, pageNumber]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  function select(block: Block) {
    const existing = edits.find(edit => edit.page === pageNumber && edit.block_id === block.id);
    setSelected(block); setText(existing?.text ?? block.text); setFont(existing?.font ?? block.font); setFontSize(existing?.font_size ?? Math.min(48, Math.max(6, block.font_size)));
  }
  function invalidate() { setPreview(null); setSaved(null); }
  function queue() {
    if (!selected) return;
    try {
      const next = [...edits.filter(edit => edit.page !== pageNumber || edit.block_id !== selected.id), { page: pageNumber, block_id: selected.id, text, font, font_size: fontSize }];
      setEdits(pdfEditsSchema.parse(next)); invalidate(); setError("");
    } catch { setError("Use nonempty text up to 4,000 characters, font size 6–48, and at most ten blocks per preview."); }
  }
  async function previewEdits() {
    setBusy(true); setError(""); invalidate();
    try {
      const response = await fetch("/api/cvs/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cv_id: cvId, edits: pdfEditsSchema.parse(edits) }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Could not preview edits."); }
      const blob = await response.blob(); setPreview({ blob, url: URL.createObjectURL(blob) });
    } catch (error) { setError(error instanceof Error ? error.message : "Preview failed."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!preview) return;
    setBusy(true); setError("");
    try {
      const body = new FormData();
      body.set("file", new File([preview.blob], `${cvName.replace(/\.pdf$/i, "")}-tailored.pdf`, { type: "application/pdf" }));
      // No replace_id: preserve the source PDF and create a new current CV version.
      const response = await fetch("/api/cvs", { method: "POST", body });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Could not save the edited CV.");
      setSaved(data.cv);
    } catch (error) { setError(error instanceof Error ? error.message : "Save failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5"><div><h1 className="text-3xl font-bold">Edit your PDF CV</h1><p className="mt-2 break-all text-slate-600">{cvName}</p><a href={`/api/cvs/download?cv_id=${encodeURIComponent(cvId)}`} className="text-violet-700 underline">Download source PDF</a></div>
    <p className="rounded bg-amber-50 p-4 text-sm text-amber-900">Select an original text block and replace text in that same area. Other content/page geometry is retained; text that does not fit is rejected. Standard replacement fonts can differ from embedded originals. Upright Latin text only; custom fonts, rotated text, scanned and signed PDFs are not supported. Preview before saving. The source PDF stays unchanged.</p>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{error}</p>}
    {suggestions.length > 0 && <details className="rounded border border-slate-200 bg-white p-4"><summary className="font-semibold">Company-tailored suggestions for this CV</summary><div className="mt-3 space-y-4">{suggestions.map((suggestion, index) => <div key={index} className="space-y-2"><blockquote className="text-sm text-slate-500">{suggestion.original_quote}</blockquote><p>{suggestion.suggested_text}</p><p className="text-sm text-slate-600">{suggestion.reason}</p><button disabled={!selected || busy} onClick={() => { setText(suggestion.suggested_text); invalidate(); }} className="rounded border px-3 py-1 text-sm">Use in selected block</button></div>)}</div></details>}
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,1fr)]">
      <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3"><div className="mb-3 flex items-center justify-between gap-3"><button disabled={loading || busy || pageNumber === 0} onClick={() => setPageNumber(value => value - 1)} className="rounded border px-3 py-1">Previous</button><span>Page {pageNumber + 1}{page ? ` / ${page.page_count}` : ""}</span><button disabled={loading || busy || !page || pageNumber + 1 >= page.page_count} onClick={() => setPageNumber(value => value + 1)} className="rounded border px-3 py-1">Next</button></div>
        {loading && <p role="status" className="p-8">Rendering original PDF page...</p>}
        {page && <div className="relative overflow-hidden border border-slate-100"><Image src={page.image} alt={`Original CV page ${pageNumber + 1}`} width={Math.round(page.width)} height={Math.round(page.height)} unoptimized className="block h-auto w-full" />{page.blocks.filter(block => block.editable).map(block => <button key={block.id} disabled={busy} type="button" onClick={() => select(block)} aria-label={`Edit text: ${block.text.slice(0, 70)}`} className={`absolute border-2 ${selected?.id === block.id ? "border-violet-600 bg-violet-100/20" : "border-transparent hover:border-violet-400 hover:bg-violet-100/20"}`} style={{ left: `${block.bbox[0] / page.width * 100}%`, top: `${block.bbox[1] / page.height * 100}%`, width: `${(block.bbox[2] - block.bbox[0]) / page.width * 100}%`, height: `${(block.bbox[3] - block.bbox[1]) / page.height * 100}%` }} />)}</div>}
        {page?.rotated && <p className="mt-3 text-sm text-amber-800">Rotate this page upright outside the editor before changing text.</p>}
        {page && !page.blocks.some(block => block.editable) && <p className="mt-3 text-sm text-amber-800">No safe editable text blocks were found. Scanned/OCR image text, overlapping images and rotated text need a different editing workflow.</p>}
      </section>
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-lg font-semibold">Select a text block</h2>{page && <select aria-label="Original text block" value={selected?.id ?? ""} onChange={event => { const block = page.blocks.find(block => block.id === Number(event.target.value)); if (block) select(block); }} className="w-full rounded border p-2"><option value="">Choose on the page or from this list</option>{page.blocks.filter(block => block.editable).map(block => <option key={block.id} value={block.id}>{block.text.slice(0, 90)}</option>)}</select>}
        {selected && <><p className="text-sm text-slate-500">Original font: {selected.original_font}, {selected.font_size} pt</p><label className="block">Replacement text<textarea rows={9} maxLength={4000} value={text} onChange={event => { setText(event.target.value); invalidate(); }} className="mt-1 w-full rounded border p-2" /></label><div className="grid grid-cols-2 gap-3"><label>Replacement font<select value={font} onChange={event => { setFont(event.target.value as PdfEdit["font"]); invalidate(); }} className="mt-1 w-full rounded border p-2">{Object.entries(fonts).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Size (pt)<input type="number" min={6} max={48} step={0.5} value={fontSize} onChange={event => { setFontSize(Number(event.target.value)); invalidate(); }} className="mt-1 w-full rounded border p-2" /></label></div><button disabled={busy} onClick={queue} className="rounded border border-violet-300 px-4 py-2 text-violet-800">Queue this change</button></>}
        <h3 className="font-semibold">Queued changes ({edits.length}/10)</h3><ul className="space-y-2">{edits.map(edit => <li key={`${edit.page}:${edit.block_id}`} className="rounded bg-slate-50 p-2 text-sm">Page {edit.page + 1}: {edit.text.slice(0, 80)} <button disabled={busy} onClick={() => { setEdits(current => current.filter(item => item !== edit)); invalidate(); }} className="ml-2 text-red-700 underline">Remove</button></li>)}</ul><button disabled={busy || !edits.length} onClick={() => void previewEdits()} className="rounded bg-violet-700 px-4 py-2 text-white">{busy ? "Working..." : "Preview edited PDF"}</button>
      </section>
    </div>
    {preview && <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4"><h2 className="text-xl font-semibold">Review the edited PDF</h2><iframe title="Edited PDF preview" src={preview.url} className="h-[650px] w-full rounded border" /><div className="flex flex-wrap gap-4"><a href={preview.url} download={`${cvName.replace(/\.pdf$/i, "")}-tailored.pdf`} className="rounded border px-4 py-2 text-violet-800">Download reviewed PDF</a><button disabled={busy || !!saved} onClick={() => void save()} className="rounded bg-violet-700 px-4 py-2 text-white">{saved ? "Saved as a new CV" : busy ? "Saving..." : "Approve and save as new current CV"}</button></div><p className="text-sm text-slate-600">Saving reparses the PDF and skills. Existing company reports/drafts stay tied to the earlier CV; rerun them for the new version.</p></section>}
    {saved && <p role="status" className="rounded bg-green-50 p-3 text-green-900">Edited CV saved; original retained. <Link href="/profile" className="underline">Open profile</Link> or <Link href="/companies" className="underline">rerun company comparison</Link>.</p>}
  </div>;
}
