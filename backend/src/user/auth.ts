import type { Env } from "../lib/env";
import { json } from "../lib/http";
import { magicIdentity } from "./magic";
import {
  deleteSession,
  ensureUserSchema,
  getSession,
  joinWaitlist,
  putSession,
  setUsername,
  touchLogin,
  upsertUser,
  type User,
} from "./db";

const SESSION_MS = 30 * 86_400_000;

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function rawToken() {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function publicUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    wallet: user.wallet,
    createdAt: user.createdAt,
  };
}

export async function sessionUser(req: Request, env: Env) {
  const h = req.headers.get("authorization") ?? "";
  const raw = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (!raw) return null;
  const sess = await getSession(env, await sha256Hex(raw));
  return sess?.user ?? null;
}

async function login(req: Request, env: Env) {
  const body = (await req.json().catch(() => ({}))) as { didToken?: string };
  const did = body.didToken?.trim() ?? "";
  if (!did) return json({ error: "didToken required" }, 400);
  let ident: Awaited<ReturnType<typeof magicIdentity>>;
  try {
    ident = await magicIdentity(env, did);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "invalid Magic token" }, 401);
  }
  await joinWaitlist(env, ident.email);
  const user = await upsertUser(env, ident.email, {
    issuer: ident.issuer,
    wallet: ident.wallet,
  });
  await touchLogin(env, user.id);
  const session = rawToken();
  await putSession(env, user.id, await sha256Hex(session), Date.now() + SESSION_MS);
  return json({ token: session, user: publicUser(user) });
}

async function me(req: Request, env: Env) {
  const user = await sessionUser(req, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  return json({ user: publicUser(user) });
}

async function logout(req: Request, env: Env) {
  const h = req.headers.get("authorization") ?? "";
  const raw = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  if (raw) await deleteSession(env, await sha256Hex(raw));
  return json({ ok: true });
}

async function username(req: Request, env: Env) {
  const user = await sessionUser(req, env);
  if (!user) return json({ error: "unauthorized" }, 401);
  const body = (await req.json().catch(() => ({}))) as { username?: string };
  const next = await setUsername(env, user.id, body.username ?? "");
  if (!next) return json({ error: "username taken or invalid" }, 400);
  return json({ user: publicUser(next) });
}

export async function handleAuth(req: Request, env: Env) {
  await ensureUserSchema(env);
  const path = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
  if (path === "/v1/auth/login" && req.method === "POST") return login(req, env);
  if (path === "/v1/auth/me" && req.method === "GET") return me(req, env);
  if (path === "/v1/auth/logout" && req.method === "POST") return logout(req, env);
  if (path === "/v1/auth/username" && req.method === "PATCH") return username(req, env);
  return json({ error: "not found", path }, 404);
}
