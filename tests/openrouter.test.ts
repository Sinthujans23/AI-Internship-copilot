import test from "node:test";
import assert from "node:assert/strict";
import { getOpenAI, aiModel, providerOptions } from "../src/lib/services/openai";
import { providerErrorDetails } from "../src/lib/ai/provider-error";

test("OpenRouter sends schema requests to its endpoint and never falls back to the OpenAI key", async () => {
  const saved = { ...process.env };
  try {
    process.env.AI_PROVIDER = "openrouter";
    process.env.OPENAI_API_KEY = "test-openai-key";
    delete process.env.OPENROUTER_API_KEY;
    assert.throws(() => getOpenAI(), /OPENROUTER_API_KEY/);
    process.env.OPENROUTER_API_KEY = "test-router-key";
    delete process.env.OPENROUTER_MODEL;
    const client = getOpenAI();
    assert.equal(client.baseURL, "https://openrouter.ai/api/v1");
    assert.equal(client.apiKey, "test-router-key");
    assert.equal(aiModel(), "openai/gpt-4.1-mini");
    assert.deepEqual(providerOptions(), { provider: { require_parameters: true } });
    assert.match(providerErrorDetails({status:401}).message, /OPENROUTER_API_KEY/);
    assert.match(providerErrorDetails({status:402}).message, /OpenRouter credits/);
    process.env.AI_PROVIDER = "openai";
    assert.equal(getOpenAI().baseURL, "https://api.openai.com/v1");
    assert.equal(getOpenAI().apiKey, "test-openai-key");
    assert.deepEqual(providerOptions(), {});
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});
