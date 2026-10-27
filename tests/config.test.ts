import test from "node:test";
import assert from "node:assert/strict";
import { getSupabaseConfig } from "../src/lib/supabase/config";

test("invalid configuration cannot crash a page; hosted/local URLs remain supported", () => {
  const savedUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const savedKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  try {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-only-key";
    for (const url of ["", "your-project-url", "https:example.supabase.co", "https://", "file:///tmp"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      assert.equal(getSupabaseConfig(), null);
    }
    for (const url of ["https://example.supabase.co", "http://localhost:54321"]) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ` ${url} `;
      assert.equal(getSupabaseConfig()?.url, url);
    }
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";
    assert.equal(getSupabaseConfig(), null);
  } finally {
    if (savedUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = savedKey;
  }
});
