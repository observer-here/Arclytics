import { ensureAnalyticsSchema, getDetail, getEco, getMeta, getTokens, getWallets } from "./analytics/db";
import {
  activeRankings,
  ingestAll,
  ingestOne,
  ingestRoundRobin,
  ingestTvlFast,
} from "./analytics/ingest/compute";
import { createArcscan } from "./analytics/arcscan";
import { ingestTokens, ingestTokensRoundRobin } from "./analytics/ingest/tokens";
import { ingestWallets, maybeIngestWallets } from "./analytics/ingest/wallets";
import { handleAsk } from "./ask";
import type { Env } from "./lib/env";
import { corsPreflight, json } from "./lib/http";
import { handleAuth } from "./user/auth";
import { handleWatchlist } from "./user/watchlist";

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
        await ensureAnalyticsSchema(env);
        const arc = createArcscan(env);
        const mode = new URL(req.url).searchParams.get("mode");
        if (mode === "tokens") {
          return json(await ingestTokens(env, arc));
        }
        if (mode === "wallets") {
          return json(await ingestWallets(env, arc));
        }
        const result =
          mode === "tvl"
            ? await ingestTvlFast(env, arc)
            : mode === "batch"
              ? await ingestRoundRobin(env, arc, 3)
              : await ingestAll(env, arc);
        const tokens = await ingestTokensRoundRobin(env, arc, 3).catch((e) => ({ error: String(e) }));
        return json({ ...result, tokens });
      }

      if (path.startsWith("/v1/ingest/") && req.method === "POST") {
        if (!authorized(req, env)) return json({ error: "unauthorized" }, 401);
        await ensureAnalyticsSchema(env);
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
        await ensureAnalyticsSchema(env);
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

      if (path.startsWith("/v1/auth")) {
        return handleAuth(req, env);
      }

      if (path.startsWith("/v1/watchlist")) {
        return handleWatchlist(req, env);
      }

      if (path === "/v1/ask" && (req.method === "GET" || req.method === "POST")) {
        return handleAsk(req, env);
      }

      if (path === "/v1/wallets" && req.method === "GET") {
        await ensureAnalyticsSchema(env);
        let data = await getWallets(env);
        if (!data?.items?.length) {
          const arc = createArcscan(env);
          await ingestWallets(env, arc).catch(() => null);
          data = await getWallets(env);
        }
        if (!data?.items?.length) {
          return json({
            items: [],
            stats: null,
            stale: true,
            message: "No wallet rankings yet — run POST /v1/ingest?mode=wallets",
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
        await ensureAnalyticsSchema(env);
        const arc = createArcscan(env);
        await ingestRoundRobin(env, arc, 3);
        await ingestTokensRoundRobin(env, arc, 3);
        await maybeIngestWallets(env, arc, 30 * 60_000);
      })(),
    );
  },
};
