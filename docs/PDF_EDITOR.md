# Edit the original PDF layout by text region

## Setup and run

The matching service now also exposes private `/pdf/inspect` and `/pdf/edit` endpoints using PyMuPDF. From the repository root:

```powershell
python -m venv matching-service/.venv
matching-service/.venv/Scripts/python.exe -m pip install -r matching-service/requirements.txt
npm.cmd run dev:matching
```

On macOS/Linux use `matching-service/.venv/bin/python` instead. The npm launcher prefers this project virtual environment, supplies the env/app folders, and uses port 18000. Restart an older running service so it loads the new endpoints/dependency. Keep the same `MATCHING_SERVICE_API_KEY` in both ignored env files. PDF editing does not require OpenAI or a paid AI request.

## Use

1. Upload a text-based PDF at `/profile`. Each CV has **Edit original PDF layout** and **Download PDF** links.
2. Open the PDF editor. A company report can open the same source CV with its tailored suggestions alongside it.
3. Choose a text block on the rendered page or from the accessible block list. Enter replacement text, choose a standard font/size, and **Queue this change**. Up to ten nonduplicated blocks across pages can be queued.
4. **Preview edited PDF** performs a server-side fit check and returns a temporary PDF to the browser. No database row is saved at this point. Overflow is rejected rather than reflowing nearby content or silently shrinking text.
5. Inspect the actual PDF preview. Download it, or **Approve and save as new current CV**. Saving reparses the generated file through the CV upload API and extracts fresh skills. It creates a new row/file, keeping the original PDF unchanged. Rerun company comparisons after editing; earlier reports/drafts remain snapshots of the old CV.

## Preservation and limits

- The source file is never overwritten. Selected text is removed using redaction and replaced within its original bounding box; old hidden text is not merely covered by a white rectangle.
- Page count/geometry and unrelated content stay in place. Regression tests compare unchanged-page pixels and an unchanged region on the edited page.
- Replacement fonts are standard embedded Helvetica/Times/Courier variants, **not** a guarantee that an arbitrary original embedded font, exact spacing, bold/italic spans within a mixed block, or every complex layout will be identical. The editor exposes font/size and requires a preview for review.
- Supports PDFs up to 4 MB and 10 pages, upright horizontal text, Latin letters and common CV punctuation. Scanned/image text, OCR text overlapping a background image, rotated text, overlapping text blocks, encrypted/signed PDFs, custom font workflows and non-Latin replacements are unsupported. Unsupported edits fail without saving a new PDF.
- There is no automatic paragraph reflow, full word processor, or promise of layout-perfect edits for every PDF. A longer rewrite may need shorter wording or an explicitly chosen smaller font to fit.
- Preview images/PDFs are scoped to a verified owned CV. Next.js downloads from private Storage; arbitrary file paths/PDF URLs/rectangles are not accepted from the browser. The private service also requires its shared key. PyMuPDF operations are serialized to avoid unsafe native-library concurrency.

## Verify

```powershell
matching-service/.venv/Scripts/python.exe -m unittest discover -s matching-service -v
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Test a short edit, oversized replacement, multiple blocks/pages, common punctuation, browser preview/download, save/refresh, original retention and second-user denial. The newest saved CV must be used for subsequent comparison. No actual personal CV or paid provider is needed for the generated-PDF regression tests. Live private Storage and browser interaction still need a signed-in account.

Implementation follows the official [PyMuPDF Page API](https://pymupdf.readthedocs.io/en/latest/page.html) for text extraction, text-box fitting, redaction and rendering.
