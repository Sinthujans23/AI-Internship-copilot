import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Isolated PostgreSQL only: no published ports, secrets or hosted Supabase access.
const name = `internship-cv-v2-test-${Date.now()}`;
function docker(args, input) {
  const result = spawnSync("docker", args, { input, encoding: "utf8", windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || "Docker command failed. Start Docker Desktop first.");
  return result.stdout;
}
let started = false;
try {
  docker(["run", "--rm", "-d", "--network", "none", "--name", name, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", process.argv.includes("--rag")?"pgvector/pgvector:pg17":"postgres:17-alpine"]);
  started = true;
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const probe = spawnSync("docker", ["exec", name, "pg_isready", "-U", "postgres"], { windowsHide: true });
    if (probe.status === 0) { ready = true; break; }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!ready) throw new Error("Temporary PostgreSQL did not become ready.");
  const files = process.argv.includes("--rag")
    ? ["tests/sql/cv-v2-fixture.sql", "supabase/migrations/20261028030000_company_rag.sql", "tests/sql/rag-assertions.sql", "supabase/migrations/20261028030000_company_rag.sql"]
    : process.argv.includes("--github")
    ? ["tests/sql/cv-v2-fixture.sql", "supabase/migrations/20261028020000_github_intelligence.sql", "tests/sql/github-assertions.sql", "supabase/migrations/20261028020000_github_intelligence.sql"]
    : process.argv.includes("--hybrid")
    ? ["tests/sql/cv-v2-fixture.sql", "supabase/migrations/20261028010000_hybrid_job_matching.sql", "tests/sql/hybrid-assertions.sql", "supabase/migrations/20261028010000_hybrid_job_matching.sql"]
    : ["tests/sql/cv-v2-fixture.sql", "supabase/migrations/20261028000000_cv_analyzer_v2.sql", "tests/sql/cv-v2-assertions.sql", "supabase/migrations/20261028000000_cv_analyzer_v2.sql"];
  for (const file of files) {
    docker(["exec", "-i", name, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1"], readFileSync(file, "utf8"));
    console.log(`PASS ${file}`);
  }
} finally {
  if (started) docker(["stop", name]);
}
