import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const backend = join(root, "backend");
const api = process.env.VITE_API_URL?.replace(/\/$/, "") || "https://arclytics-api.dartajamul108.workers.dev";

function run(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

console.log("Deploying worker…");
run("pnpm", ["exec", "wrangler", "deploy"], backend);

console.log("Ensuring remote D1 schema…");
run("pnpm", ["exec", "wrangler", "d1", "execute", "arclytics", "--remote", "--file=./schema.sql"], backend);

console.log("Health check…");
const health = await fetch(`${api}/v1/health`).then((r) => r.json()).catch(() => null);
console.log(health);

if (!process.env.SKIP_INGEST) {
  console.log("Running full ingest (protocols + tokens)…");
  const headers = process.env.INGEST_SECRET
    ? { authorization: `Bearer ${process.env.INGEST_SECRET}` }
    : {};
  const ingest = await fetch(`${api}/v1/ingest`, { method: "POST", headers }).then((r) => r.json());
  console.log(ingest);
}

const tokens = await fetch(`${api}/v1/tokens`).then((r) => r.json()).catch(() => null);
console.log("tokens endpoint:", tokens?.items?.length ?? tokens);
