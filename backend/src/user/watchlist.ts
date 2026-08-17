import type { Env } from "../lib/env";
import { json } from "../lib/http";
import { sessionUser } from "./auth";
import {
  addWatchItem,
  addWatchList,
  ensureUserSchema,
  listWatch,
  moveWatchItem,
  parseWatchKind,
  removeWatchItem,
} from "./db";

type Body = { kind?: string; id?: string; list?: string; name?: string };

export async function handleWatchlist(req: Request, env: Env) {
  await ensureUserSchema(env);
  const user = await sessionUser(req, env);
  if (!user) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const body = req.method === "POST" || req.method === "PATCH" ? ((await req.json().catch(() => ({}))) as Body) : {};
  const kind = parseWatchKind(body.kind ?? url.searchParams.get("kind"));
  const id = String(body.id ?? url.searchParams.get("id") ?? "");

  if (path === "/v1/watchlist" && req.method === "GET") return json(await listWatch(env, user.id));
  if (path === "/v1/watchlist" && req.method === "POST") {
    if (!kind || !id) return json({ error: "kind and id required" }, 400);
    const data = await addWatchItem(env, user.id, kind, id, body.list);
    if (!data) return json({ error: "watchlist full" }, 400);
    return json(data);
  }
  if (path === "/v1/watchlist" && req.method === "DELETE") {
    if (!kind || !id) return json({ error: "kind and id required" }, 400);
    return json(await removeWatchItem(env, user.id, kind, id));
  }
  if (path === "/v1/watchlist" && req.method === "PATCH") {
    if (!kind || !id || !body.list) return json({ error: "kind, id and list required" }, 400);
    return json(await moveWatchItem(env, user.id, kind, id, body.list));
  }
  if (path === "/v1/watchlist/lists" && req.method === "POST") {
    const name = body.name ?? body.list ?? "";
    if (!name.trim()) return json({ error: "name required" }, 400);
    return json(await addWatchList(env, user.id, name));
  }
  return json({ error: "not found", path }, 404);
}
