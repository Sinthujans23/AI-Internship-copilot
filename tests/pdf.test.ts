import test from "node:test";
import assert from "node:assert/strict";
import { parseCvPdf } from "../src/lib/parse-cv";

// Build a tiny real PDF so parsing is tested without a personal CV fixture.
function samplePdf(text = "Student CV Python TypeScript SQL project experience and education") {
  const stream = `BT /F1 12 Tf 50 750 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let source = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(source)); source += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(source);
  source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => { source += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  source += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Match File.arrayBuffer(): an independent buffer, not a pooled Buffer slice.
  return Buffer.from(new TextEncoder().encode(source).buffer);
}
test("extracts readable text from a real PDF buffer", async () => {
  const text = await parseCvPdf(new Uint8Array(samplePdf()));
  assert.match(text, /Python TypeScript SQL/);
});
test("blank PDF page numbers are not treated as extracted CV text", async () => {
  assert.equal(await parseCvPdf(new Uint8Array(samplePdf(""))), "");
});
