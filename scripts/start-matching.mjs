import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";

// Prefer the project environment so PDF editing uses the installed native library.
const localPython = path.join("matching-service", ".venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
const python = existsSync(localPython) ? path.resolve(localPython) : "python";
const child = spawn(python, ["-m", "uvicorn", "main:app", "--app-dir", "matching-service", "--env-file", "matching-service/.env", "--host", "127.0.0.1", "--port", "18000", "--reload", "--reload-dir", "matching-service"], { stdio: "inherit", windowsHide: true });
child.on("error", () => { console.error("Could not start Python. Create matching-service/.venv and install requirements.txt."); process.exitCode = 1; });
child.on("exit", code => { process.exitCode = code || 0; });
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
