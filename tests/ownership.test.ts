import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";
import { applicationContext } from "../src/lib/application-context";

test("a foreign or missing scoped application cannot load a CV or invoke AI", async () => {
  const filters: [string, string][] = [];
  const tables: string[] = [];
  const query = {
    select() { return this; },
    eq(column: string, value: string) { filters.push([column, value]); return this; },
    async maybeSingle() { return { data: null, error: null }; },
  };
  const client = { from(table: string) { tables.push(table); return query; } } as unknown as SupabaseClient<Database>;
  await assert.rejects(applicationContext(client, "verified-user", "foreign-application"), /Application not found/);
  assert.deepEqual(tables, ["applications"]);
  assert.deepEqual(filters, [["id", "foreign-application"], ["user_id", "verified-user"]]);
});

test("application context uses the selected owned CV version", async () => {
  const filters: [string,string][]=[];
  const client={from(table:string){return {
    select(){return this;},eq(key:string,value:string){if(table==="cvs")filters.push([key,value]);return this;},order(){return this;},limit(){return this;},
    async maybeSingle(){return {data:table==="applications"?{id:"app",cv_id:"selected-version"}:{id:"selected-version"},error:null};},
  };}} as unknown as SupabaseClient<Database>;
  const result=await applicationContext(client,"owner","app");
  assert.equal(result.cv.id,"selected-version");
  assert.deepEqual(filters,[["user_id","owner"],["id","selected-version"]]);
});
