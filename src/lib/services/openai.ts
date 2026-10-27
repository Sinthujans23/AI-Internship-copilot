import OpenAI from "openai";
export function usesOpenRouter() { return process.env.AI_PROVIDER === "openrouter"; }
export function aiModel() {
  return usesOpenRouter() ? (process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini") : (process.env.OPENAI_MODEL || "gpt-4o-mini");
}
// Only route to endpoints supporting the requested schema/tools.
export function providerOptions() {
  return usesOpenRouter() ? { provider: { require_parameters: true } } : {};
}
export function getOpenAI() {
  const router = usesOpenRouter();
  const apiKey = router ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey?.trim()) throw new Error(`AI analysis is not configured. Add ${router ? "OPENROUTER_API_KEY" : "OPENAI_API_KEY"} to the server environment.`);
  return new OpenAI({ apiKey: apiKey.trim(), baseURL: router ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1", timeout: 30000, maxRetries: 0 });
}
