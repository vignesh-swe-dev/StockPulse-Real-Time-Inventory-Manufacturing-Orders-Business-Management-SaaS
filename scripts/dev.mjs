#!/usr/bin/env node
// Runs the StockPulse backend (port 4000) and frontend (port 3000) together, cross-platform.
//   node scripts/dev.mjs            -> backend + frontend (dev mode)
//   node scripts/dev.mjs backend    -> backend only
//   node scripts/dev.mjs frontend   -> frontend only
//   node scripts/dev.mjs --prod     -> build the frontend and run it in production mode
//   node scripts/dev.mjs --demo     -> start with sample demo data (separate data file) instead of real data
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const isWin = process.platform === "win32";
const npm = isWin ? "npm.cmd" : "npm";
const args = process.argv.slice(2);
const prod = args.includes("--prod");
const demo = args.includes("--demo");
const only = args.find((a) => a === "backend" || a === "frontend");

const C = { backend: "\x1b[36m", frontend: "\x1b[35m", reset: "\x1b[0m" };
const children = [];

function ensureInstalled(dir) {
  if (existsSync(join(root, dir, "node_modules"))) return;
  console.log(`Installing ${dir} dependencies (first run only)...`);
  const r = spawnSync(npm, ["install", "--no-audit", "--no-fund"], { cwd: join(root, dir), stdio: "inherit", shell: isWin });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

function run(name, cmd, cmdArgs, env = {}) {
  const child = spawn(cmd, cmdArgs, { cwd: join(root, name), env: { ...process.env, ...env }, shell: isWin });
  const tag = `${C[name]}[${name}]${C.reset} `;
  const pipe = (stream, out) => stream.on("data", (b) => String(b).split(/\r?\n/).filter(Boolean).forEach((l) => out.write(tag + l + "\n")));
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => { console.log(`${tag}stopped (code ${code})`); shutdown(code ?? 0); });
  children.push(child);
}

function shutdown(code = 0) {
  children.forEach((c) => { try { c.kill(); } catch {} });
  process.exit(code);
}
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

const backendPort = process.env.BACKEND_PORT || "4000";
const frontendPort = process.env.FRONTEND_PORT || "3000";

if (only !== "frontend") {
  run("backend", process.execPath, [prod || only ? "src/server.mjs" : "--watch", ...(prod || only ? [] : ["src/server.mjs"])], {
    PORT: backendPort,
    ...(demo ? { DEMO_DATA: "1" } : {}),
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || `http://localhost:${frontendPort},http://127.0.0.1:${frontendPort}`
  });
}
if (only !== "backend") {
  ensureInstalled("frontend");
  const api = { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || `http://localhost:${backendPort}/api/v1` };
  if (prod) {
    console.log("Building frontend...");
    const b = spawnSync(npm, ["run", "build"], { cwd: join(root, "frontend"), stdio: "inherit", shell: isWin, env: { ...process.env, ...api } });
    if (b.status !== 0) process.exit(b.status ?? 1);
    run("frontend", npm, ["run", "start", "--", "-p", frontendPort], api);
  } else {
    run("frontend", npm, ["run", "dev", "--", "-p", frontendPort], api);
  }
}

setTimeout(() => {
  console.log(`\n  StockPulse is starting...\n  Website  : http://localhost:${frontendPort}/welcome\n  App      : http://localhost:${frontendPort}\n  API      : http://localhost:${backendPort}/api/v1\n  Stop     : press Ctrl+C\n`);
}, 1500);
