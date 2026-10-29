import { AppError } from "@/lib/api";

export async function pdfService(action: "inspect" | "edit", input: unknown) {
  const url = process.env.MATCHING_SERVICE_URL;
  const key = process.env.MATCHING_SERVICE_API_KEY;
  if (!url || !key) throw new AppError("Configure and start the matching/PDF service first.", 503);
  let response: Response;
  try {
    response = await fetch(`${url.replace(/\/$/, "")}/pdf/${action}`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-API-Key": key }, body: JSON.stringify(input), signal: AbortSignal.timeout(45000), cache: "no-store", redirect: "error",
    });
  } catch { throw new AppError("The PDF service could not be reached. Start it with npm run dev:matching.", 503); }
  if (!response.ok) {
    if (response.status === 401) throw new AppError("The PDF service key does not match the Next.js service key.", 503);
    if (response.status === 404) throw new AppError("PDF endpoint/page not found. Restart the updated matching service.", 422);
    let message = "The PDF edit could not be processed. Check the service and choose a shorter text replacement.";
    try {
      const data = await response.json();
      if (typeof data.detail === "string" && data.detail.length < 400) message = data.detail.replaceAll(key, "[redacted]");
    } catch { /* Keep a safe message for non-JSON server errors. */ }
    throw new AppError(message, response.status === 503 ? 503 : 422);
  }
  return response;
}
