type ProviderFailure = { status?: number; code?: string | null; name?: string };

// Return fixed messages only: provider messages can contain API-key fragments.
export function providerErrorDetails(error: ProviderFailure) {
  if (error.status === 401) return { status: 503, message: "OpenAI rejected the API key. Replace OPENAI_API_KEY in .env.local with a valid OpenAI API key and restart the app." };
  if (error.status === 403) return { status: 503, message: "Your OpenAI project or API key does not have permission for this request. Check its access settings." };
  if (error.status === 404 || error.code === "model_not_found") return { status: 503, message: "The configured OpenAI model is unavailable to this project. Check OPENAI_MODEL and model access." };
  if (error.status === 429) {
    const billingCodes = ["insufficient_quota", "credit_balance_exhausted", "organization_spend_limit_exceeded", "project_spend_limit_exceeded", "organization_usage_limit_exceeded"];
    return { status: 429, message: billingCodes.includes(error.code || "") ? "OpenAI API credits or a usage/spend limit are exhausted. Check your API billing and limits before retrying." : "OpenAI rate limit reached. Wait briefly and retry." };
  }
  if (error.name === "APIConnectionTimeoutError") return { status: 504, message: "The OpenAI request timed out. Please retry." };
  if (error.name === "APIConnectionError") return { status: 503, message: "Could not connect to OpenAI. Check the server's internet connection and retry." };
  if (error.status === 400) return { status: 502, message: "OpenAI rejected the request format. Check that OPENAI_MODEL supports structured outputs and function calls." };
  return { status: 502, message: "The AI provider is temporarily unavailable. Please retry later." };
}
