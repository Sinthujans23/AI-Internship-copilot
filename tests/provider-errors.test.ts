import test from "node:test";
import assert from "node:assert/strict";
import { providerErrorDetails } from "../src/lib/ai/provider-error";

test("invalid AI keys are distinguished from app-login failures", () => {
  const result = providerErrorDetails({ status: 401, code: "invalid_api_key" });
  assert.equal(result.status, 503);
  assert.match(result.message, /rejected the API key/);
});
test("quota exhaustion, throttling, and model access have distinct remedies", () => {
  assert.match(providerErrorDetails({ status: 429, code: "insufficient_quota" }).message, /billing/);
  assert.match(providerErrorDetails({ status: 429, code: "rate_limit_exceeded" }).message, /Wait/);
  assert.match(providerErrorDetails({ status: 404, code: "model_not_found" }).message, /OPENAI_MODEL/);
});
test("provider text and key fragments never appear in public errors", () => {
  const result = providerErrorDetails({ status: 401, code: "invalid_api_key", name: "contains-a-private-key-fragment" });
  assert.equal(result.message.includes("private-key-fragment"), false);
  assert.equal(providerErrorDetails({ name: "APIConnectionTimeoutError" }).status, 504);
});
