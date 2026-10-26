import OpenAI from "openai";
export function getOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("AI analysis is not configured. Add OPENAI_API_KEY to the server environment.");
  return new OpenAI({ apiKey });
}
