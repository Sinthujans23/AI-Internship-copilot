import test from "node:test";
import assert from "node:assert/strict";
import type { ChatCompletionMessage } from "openai/resources/chat/completions";
import { runToolLoop, toolNames, type ToolName } from "../src/lib/agent/tool-loop";

function call(name: string, args = "{}"): ChatCompletionMessage {
  return { role: "assistant", content: null, refusal: null, tool_calls: [{ id: `call-${name}`, type: "function", function: { name, arguments: args } }] };
}
const final: ChatCompletionMessage = { role: "assistant", content: "Review these drafts before applying.", refusal: null };

test("executes every tool and sends each result back before accepting a final answer", async () => {
  const executed: ToolName[] = [];
  const result = await runToolLoop(async (messages, available) => {
    if (executed.length) assert.ok(messages.some(message => message.role === "tool"));
    return available.length ? call(available[0].type === "function" ? available[0].function.name : "unknown") : final;
  }, async name => { executed.push(name); return { result: name }; });
  assert.deepEqual(executed, [...toolNames]);
  assert.deepEqual(result.trace, executed);
  assert.equal(result.summary, final.content);
});

test("an early final answer cannot skip the tool loop", async () => {
  await assert.rejects(runToolLoop(async () => final, async () => ({}), 2), /tool-call limit/);
});

test("foreign IDs in tool arguments are rejected before execution", async () => {
  let executed = false;
  await assert.rejects(runToolLoop(async () => call("get_cv", '{"user_id":"another-user"}'), async () => { executed = true; }), /unexpected tool arguments/);
  assert.equal(executed, false);
});

test("unknown and out-of-order tools are rejected", async () => {
  for (const name of ["delete_all", "match_score"]) {
    await assert.rejects(runToolLoop(async () => call(name), async () => ({})), /unavailable tool/);
  }
});

test("malformed tool JSON and refusals return errors", async () => {
  await assert.rejects(runToolLoop(async () => call("get_cv", "{"), async () => ({})), /invalid tool arguments/);
  await assert.rejects(runToolLoop(async () => ({ ...final, refusal: "Cannot help" }), async () => ({})), /declined/);
});
