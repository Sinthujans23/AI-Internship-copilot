import { readFile, writeFile } from "node:fs/promises";

// Exclude the obsolete prototype migration. This list is the supported schema.
const names = [
  "20261026000000_step1_applications.sql",
  "20261027000000_step2_job_analysis.sql",
  "20261027010000_step3_cvs.sql",
  "20261027020000_step4_matching.sql",
  "20261027030000_step5_agent.sql",
  "20261027050000_company_research.sql",
  "20261028000000_cv_analyzer_v2.sql",
  "20261028010000_hybrid_job_matching.sql",
  "20261028020000_github_intelligence.sql",
  "20261028030000_company_rag.sql",
  "20261028040000_learning_roadmaps.sql",
  "20261029000000_application_tracker.sql",
  "20261029010000_cv_tailoring.sql",
  "20261030000000_production_security.sql",
];
const parts = await Promise.all(names.map(async name => `-- ${name}\n${(await readFile(`supabase/migrations/${name}`, "utf8")).replace(/^\uFEFF/, "")}`));
await writeFile("supabase/setup.sql", `-- Paste this ENTIRE file into Supabase SQL Editor and Run.\n-- Creates/upgrades the supported schema without deleting your application/CV rows.\n\n${parts.join("\n\n").trimEnd()}\n`);
console.log("Generated supabase/setup.sql from the supported migrations.");
