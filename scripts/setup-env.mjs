import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";

async function read(path) {
  try { return await readFile(path, "utf8"); }
  catch (error) { if (error.code === "ENOENT") return ""; throw error; }
}
function fill(source, name, value) {
  if (parseEnv(source)[name]?.trim()) return source;
  const line = `${name}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^[ \\t]*${name}[ \\t]*=.*$`, "m");
  return pattern.test(source) ? source.replace(pattern, () => line) : `${source.trimEnd()}\n${line}\n`;
}
let web = await read(".env.local");
let service = await read("matching-service/.env");
const webValues = parseEnv(web);
const serviceValues = parseEnv(service);
const shared = webValues.MATCHING_SERVICE_API_KEY?.trim() || serviceValues.MATCHING_SERVICE_API_KEY?.trim() || randomBytes(32).toString("hex");
for (const [name, value] of Object.entries({ AI_PROVIDER: "openrouter", OPENROUTER_API_KEY: "", OPENROUTER_MODEL: "openai/gpt-4.1-mini", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", OPENAI_API_KEY: "", OPENAI_MODEL: "gpt-4o-mini", MATCHING_SERVICE_URL: "http://127.0.0.1:18000", MATCHING_SERVICE_API_KEY: shared })) web = fill(web, name, value);
for (const [name, value] of Object.entries({ AI_PROVIDER: webValues.AI_PROVIDER || "openrouter", OPENROUTER_API_KEY: webValues.OPENROUTER_API_KEY || "", OPENROUTER_EMBEDDING_MODEL: "openai/text-embedding-3-small", OPENAI_API_KEY: webValues.OPENAI_API_KEY || "", EMBEDDING_MODEL: "text-embedding-3-small", MATCHING_SERVICE_API_KEY: shared, MATCH_THRESHOLD: "0.65" })) service = fill(service, name, value);
await writeFile(".env.local", web, { mode: 0o600 });
await writeFile("matching-service/.env", service, { mode: 0o600 });
console.log("Local env files prepared; existing nonempty values preserved. No keys printed.");
if (!(parseEnv(web).AI_PROVIDER === "openrouter" ? parseEnv(web).OPENROUTER_API_KEY : parseEnv(web).OPENAI_API_KEY)?.trim()) console.log("Manual step: add the selected provider key (OPENROUTER_API_KEY or OPENAI_API_KEY) to .env.local and matching-service/.env before live AI calls.");
if (parseEnv(web).MATCHING_SERVICE_API_KEY !== parseEnv(service).MATCHING_SERVICE_API_KEY) console.log("Manual step: the service keys differ. Set the same value in both env files.");
