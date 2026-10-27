// Load the Node worker before the parser, including in serverless environments.
export async function parseCvPdf(data: Uint8Array) {
  const { getPath } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  PDFParse.setWorker(getPath());
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    // Ignore page-number separators: image-only PDFs must remain empty.
    return result.pages.map(page => page.text).join("\n\n").trim();
  }
  finally { await parser.destroy(); }
}
