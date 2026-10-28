import test from "node:test";
import assert from "node:assert/strict";
import { parseCvPdf } from "../src/lib/parse-cv";

import { samplePdf } from "./fixtures/pdf";

test("extracts readable text from a real PDF buffer", async () => {
  const text = await parseCvPdf(new Uint8Array(samplePdf()));
  assert.match(text, /Python TypeScript SQL/);
});
test("blank PDF page numbers are not treated as extracted CV text", async () => {
  assert.equal(await parseCvPdf(new Uint8Array(samplePdf(""))), "");
});
