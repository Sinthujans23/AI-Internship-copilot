import test from "node:test";
import assert from "node:assert/strict";
import { pdfEditsSchema } from "../src/lib/pdf-editor-schema";

const edit = { page: 0, block_id: 2, text: "Actual project experience", font: "helv", font_size: 11 };
test("PDF edit validation rejects duplicate blocks, arbitrary rectangles, and oversized changes", () => {
  assert.equal(pdfEditsSchema.safeParse([edit]).success, true);
  assert.equal(pdfEditsSchema.safeParse([edit, edit]).success, false);
  assert.equal(pdfEditsSchema.safeParse([{ ...edit, bbox: [0, 0, 100, 100] }]).success, false);
  assert.equal(pdfEditsSchema.safeParse([{ ...edit, text: "x".repeat(4001) }]).success, false);
  assert.equal(pdfEditsSchema.safeParse([{ ...edit, font_size: 1 }]).success, false);
});
