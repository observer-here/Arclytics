import type { Env } from "../lib/env";

export type User = {
  id: string;
  email: string;
  username: string | null;
  wallet: string | null;
  createdAt: number;
  lastLoginAt: number | null;
};

export type WaitlistRow = {
  email: string;
  source: string;
  createdAt: number;
  notifiedAt: number | null;
};

export type Session = {
  hash: string;
  userId: string;
  expiresAt: number;
  createdAt: number;
};

type UserRow = {
  id: string;
  email: string;
  username: string | null;
  wallet: string | null;
  created_at: number;
  last_login_at: number | null;
};

type WaitlistSql = {
  email: string;
  source: string;
  created_at: number;
  notified_at: number | null;
};

type SessionRow = {
  hash: string;
  user_id: string;
  expires_at: number;
  created_at: number;
};

function emailOf(email: string) {
  return email.trim().toLowerCase();
}

export function usernameOf(raw: string) {
  const s = raw.trim().toLowerCase().replace(/^@+/, "");
  return /^[a-z0-9][a-z0-9_-]{2,19}$/.test(s) ? s : null;
}

function userOf(row: UserRow): User {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    wallet: row.wallet,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

function waitlistOf(row: WaitlistSql): WaitlistRow {
  return {
    email: row.email,
    source: row.source,
    createdAt: row.created_at,
    notifiedAt: row.notified_at,
  };
}

export async function ensureUserSchema(env: Env) {
  await env.USER_DB.batch([
    env.USER_DB.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, username TEXT UNIQUE,
      wallet TEXT, magic_issuer TEXT UNIQUE,
      created_at INTEGER NOT NULL, last_login_at INTEGER)`),
    env.USER_DB.prepare(`CREATE TABLE IF NOT EXISTS waitlist (
      email TEXT PRIMARY KEY, source TEXT NOT NULL DEFAULT 'web',
      created_at INTEGER NOT NULL, notified_at INTEGER)`),
    env.USER_DB.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      hash TEXT PRIMARY KEY, user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`),
    env.USER_DB.prepare(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id)`),
  ]);
  await env.USER_DB.prepare(`ALTER TABLE users ADD COLUMN username TEXT`).run().catch(() => undefined);
  await env.USER_DB.prepare(`ALTER TABLE users ADD COLUMN wallet TEXT`).run().catch(() => undefined);
  await env.USER_DB.prepare(`ALTER TABLE users ADD COLUMN magic_issuer TEXT`).run().catch(() => undefined);
  await env.USER_DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users (username)`).run();
  await env.USER_DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_issuer ON users (magic_issuer)`).run().catch(() => undefined);
}

export async function joinWaitlist(env: Env, email: string, source = "web") {
  const e = emailOf(email);
  const now = Date.now();
  const res = await env.USER_DB.prepare(
    `INSERT INTO waitlist (email, source, created_at) VALUES (?, ?, ?)
     ON CONFLICT(email) DO NOTHING`,
  )
    .bind(e, source, now)
    .run();
  return { email: e, created: (res.meta.changes ?? 0) > 0 };
}

export async function getWaitlist(env: Env, email: string) {
  const row = await env.USER_DB.prepare(
    `SELECT email, source, created_at, notified_at FROM waitlist WHERE email = ?`,
  )
    .bind(emailOf(email))
    .first<WaitlistSql>();
  return row ? waitlistOf(row) : null;
}

const USER_COLS = "id, email, username, wallet, created_at, last_login_at";

export async function getUserById(env: Env, id: string) {
  const row = await env.USER_DB.prepare(`SELECT ${USER_COLS} FROM users WHERE id = ?`)
    .bind(id)
    .first<UserRow>();
  return row ? userOf(row) : null;
}

export async function getUserByEmail(env: Env, email: string) {
  const row = await env.USER_DB.prepare(`SELECT ${USER_COLS} FROM users WHERE email = ?`)
    .bind(emailOf(email))
    .first<UserRow>();
  return row ? userOf(row) : null;
}

export async function getUserByUsername(env: Env, username: string) {
  const name = usernameOf(username);
  if (!name) return null;
  const row = await env.USER_DB.prepare(`SELECT ${USER_COLS} FROM users WHERE username = ?`)
    .bind(name)
    .first<UserRow>();
  return row ? userOf(row) : null;
}

async function nextAutoUsername(env: Env) {
  const { results } = await env.USER_DB.prepare(
    `SELECT username FROM users WHERE username GLOB 'username-[0-9]*'`,
  ).all<{ username: string }>();
  let max = 0;
  for (const row of results ?? []) {
    const n = Number(/^username-(\d+)$/.exec(row.username)?.[1]);
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `username-${max + 1}`;
}

export async function upsertUser(
  env: Env,
  email: string,
  opts?: { issuer?: string; wallet?: string | null },
): Promise<User> {
  const e = emailOf(email);
  const existing = await getUserByEmail(env, e);
  const name = existing?.username ?? (await nextAutoUsername(env));
  await env.USER_DB.prepare(
    `INSERT INTO users (id, email, username, wallet, magic_issuer, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       username = COALESCE(users.username, excluded.username),
       wallet = COALESCE(excluded.wallet, users.wallet),
       magic_issuer = COALESCE(excluded.magic_issuer, users.magic_issuer)`,
  )
    .bind(existing?.id ?? crypto.randomUUID(), e, name, opts?.wallet ?? null, opts?.issuer ?? null, Date.now())
    .run();
  const user = await getUserByEmail(env, e);
  if (!user) throw new Error("user insert failed");
  return user;
}

export async function setUsername(env: Env, userId: string, raw: string) {
  const name = usernameOf(raw);
  if (!name) return null;
  const taken = await getUserByUsername(env, name);
  if (taken && taken.id !== userId) return null;
  await env.USER_DB.prepare(`UPDATE users SET username = ? WHERE id = ?`).bind(name, userId).run();
  return getUserById(env, userId);
}

export async function touchLogin(env: Env, userId: string) {
  await env.USER_DB.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`)
    .bind(Date.now(), userId)
    .run();
}

export async function putSession(env: Env, userId: string, hash: string, expiresAt: number) {
  const now = Date.now();
  await env.USER_DB.prepare(
    `INSERT INTO sessions (hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
  )
    .bind(hash, userId, expiresAt, now)
    .run();
}

export async function getSession(env: Env, hash: string) {
  const now = Date.now();
  const row = await env.USER_DB.prepare(
    `SELECT hash, user_id, expires_at, created_at FROM sessions WHERE hash = ?`,
  )
    .bind(hash)
    .first<SessionRow>();
  if (!row || row.expires_at < now) return null;
  const user = await getUserById(env, row.user_id);
  if (!user) return null;
  return {
    session: {
      hash: row.hash,
      userId: row.user_id,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    } satisfies Session,
    user,
  };
}

export async function deleteSession(env: Env, hash: string) {
  await env.USER_DB.prepare(`DELETE FROM sessions WHERE hash = ?`).bind(hash).run();
}

export async function deleteUserSessions(env: Env, userId: string) {
  await env.USER_DB.prepare(`DELETE FROM sessions WHERE user_id = ?`).bind(userId).run();
}
