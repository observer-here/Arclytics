import { getDetail, getEco, getMeta, getTokens } from "./db";
import {
  activeRankings,
  ingestAll,
  ingestOne,
  ingestRoundRobin,
  ingestTvlFast,
} from "./compute";
import type { Env } from "./env";
import { corsPreflight, json } from "./http";
import { createArcscan } from "./arcscan";
import { ingestTokens, maybeIngestTokens } from "./tokens";

async function ensureSchema(env: Env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS protocol_latest (
      slug TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS protocol_detail (
      slug TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS protocol_snaps (
      slug TEXT NOT NULL, day INTEGER NOT NULL, tvl REAL NOT NULL DEFAULT 0,
      volume REAL NOT NULL DEFAULT 0, fees REAL NOT NULL DEFAULT 0,
      users INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (slug, day))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS eco_latest (
      id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS tokens_latest (
      id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS token_snaps (
      address TEXT NOT NULL, day INTEGER NOT NULL, price REAL NOT NULL DEFAULT 0,
      mcap REAL NOT NULL DEFAULT 0, holders INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (address, day))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
  ]);
}

function authorized(req: Request, env: Env) {
  if (!env.INGEST_SECRET) return true;
  const h = req.headers.get("authorization") ?? "";
  return h === `Bearer ${env.INGEST_SECRET}`;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === "OPTIONS") return corsPreflight();

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (path === "/health" || path === "/v1/health") {
        const last = await getMeta(env, "last_ingest").catch(() => null);
        return json({ ok: true, lastIngest: last ? Number(last) : null });
      }

      if (path === "/v1/ingest" && req.method === "POST") {
        if (!authorized(req, env)) return json({ error: "unauthorized" }, 401);
        await ensureSchema(env);
        const arc = createArcscan(env);
        const mode = new URL(req.url).searchParams.get("mode");
        if (mode === "tokens") {
          return json(await ingestTokens(env, arc));
        }
        const result =
          mode === "tvl"
            ? await ingestTvlFast(env, arc)
            : mode === "batch"
              ? await ingestRoundRobin(env, arc, 3)
              : await ingestAll(env, arc);
        // Refresh token cache after protocol ingest (throttled on batch)
        const tokens =
          mode === "batch"
            ? await maybeIngestTokens(env, arc)
            : await ingestTokens(env, arc).catch((e) => ({ error: String(e) }));
        return json({ ...result, tokens });
      }

      if (path.startsWith("/v1/ingest/") && req.method === "POST") {
        if (!authorized(req, env)) return json({ error: "unauthorized" }, 401);
        await ensureSchema(env);
        const slug = path.slice("/v1/ingest/".length);
        const result = await ingestOne(env, createArcscan(env), slug);
        return json(result);
      }

      if (path === "/v1/protocols" && req.method === "GET") {
        const rows = await activeRankings(env);
        if (!rows.length) {
          return json({ items: [], stale: true, message: "No data yet — run POST /v1/ingest" });
        }
        return json({
          items: rows,
          updatedAt: Math.max(...rows.map((r) => r.updatedAt)),
        });
      }

      if (path.startsWith("/v1/protocols/") && req.method === "GET") {
        const slug = path.slice("/v1/protocols/".length);
        if (!slug || slug.includes("/")) return json({ error: "not found" }, 404);
        const detail = await getDetail(env, slug);
        if (!detail) return json({ error: "not found", slug }, 404);
        return json(detail);
      }

      if (path === "/v1/ecosystem" && req.method === "GET") {
        const eco = await getEco(env);
        if (!eco) return json({ error: "No data yet — run POST /v1/ingest" }, 404);
        return json(eco);
      }

      if (path === "/v1/tokens" && req.method === "GET") {
        const data = await getTokens(env);
        if (!data?.items?.length) {
          return json({
            items: [],
            stale: true,
            message: "No data yet — run POST /v1/ingest?mode=tokens",
          });
        }
        return json(data);
      }

      return json({ error: "not found", path }, 404);
    } catch (err) {
      return json({ error: String(err) }, 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        await ensureSchema(env);
        const arc = createArcscan(env);
        await ingestRoundRobin(env, arc, 3);
        await maybeIngestTokens(env, arc, 10 * 60_000);
      })(),
    );
  },
};
