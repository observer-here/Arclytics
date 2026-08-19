import type { Env } from "../lib/env";

export type RankingRow = {
  slug: string;
  name: string;
  category: string;
  tvlUsd: number;
  volume24h: number;
  fees24h?: number;
  age?: string;
  txs: number;
  transfers: number;
  contracts: string[];
  spark7d: number[];
  change24h?: number;
  change7d?: number;
  change1m?: number;
  mcapTvl?: number;
  activeUsers24h: number;
  updatedAt: number;
};

export type DetailPayload = {
  protocol: {
    slug: string;
    name: string;
    category: string;
    description?: string;
    website?: string;
    docs?: string;
    twitter?: string;
    discord?: string;
    feeBps?: number;
    contracts: Array<{ address: string; role: string; label?: string }>;
  };
  rank: number;
  tvlUsd: number;
  volume24h: number;
  fees24h: number;
  change24h?: number;
  changeVol?: number;
  changeFees?: number;
  changeUsers?: number;
  activeUsers: number;
  age?: string;
  tvlSeries: Array<{ date: string; value: number }>;
  volSeries: Array<{ date: string; value: number }>;
  feeSpark: number[];
  tvlSpark: number[];
  volSpark: number[];
  userSpark: number[];
  contracts: Array<{
    address: string;
    label: string;
    role: string;
    tvlUsd: number;
    txs: number;
    transfers: number;
  }>;
  breakdown: Array<{ label: string; value: number }>;
  pairs: Array<{ pair: string; volume24h: number; apr: number }>;
  activity: {
    txs: Array<{ date: string; value: number }>;
    transfers: Array<{ date: string; value: number }>;
    unique: Array<{ date: string; value: number }>;
  };
  txs: Array<Record<string, unknown>>;
  totals: { txs: number; transfers: number };
  paymentStats?: PaymentRouterStats;
  updatedAt: number;
};

export type PaymentRouterStats = {
  lifetimeCalls: number;
  loggedVolumeUsd: number;
  routerReceivedUsd: number;
  routerSentUsd: number;
  uniqueRecipients?: number;
};

const DAY_MS = 86_400_000;

export function dayKey(ts = Date.now()) {
  return Math.floor(ts / DAY_MS);
}

export async function ensureAnalyticsSchema(env: Env) {
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
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS token_latest (
      address TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS wallets_latest (
      id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS token_snaps (
      address TEXT NOT NULL, day INTEGER NOT NULL, price REAL NOT NULL DEFAULT 0,
      mcap REAL NOT NULL DEFAULT 0, holders INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (address, day))`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY, value TEXT NOT NULL)`),
  ]);
  await migrateTokenBlob(env);
}

export async function saveRanking(env: Env, row: RankingRow) {
  await env.DB.prepare(
    `INSERT INTO protocol_latest (slug, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(row.slug, JSON.stringify(row), row.updatedAt)
    .run();
}

export async function saveDetail(env: Env, slug: string, payload: DetailPayload) {
  await env.DB.prepare(
    `INSERT INTO protocol_detail (slug, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(slug, JSON.stringify(payload), payload.updatedAt)
    .run();
}

export async function saveSnap(
  env: Env,
  slug: string,
  day: number,
  tvl: number,
  volume: number,
  fees: number,
  users: number,
) {
  const today = dayKey();
  const existing = await env.DB.prepare(
    `SELECT tvl, volume, fees, users FROM protocol_snaps WHERE slug = ? AND day = ?`,
  )
    .bind(slug, day)
    .first<{ tvl: number; volume: number; fees: number; users: number }>();

  const isToday = day === today;
  // For past days, prefer existing ArcScan-seeded TVL over a lower sample
  const next = {
    tvl: isToday ? tvl : existing?.tvl && existing.tvl > 0 ? Math.max(existing.tvl, tvl) : tvl || existing?.tvl || 0,
    volume: isToday ? volume : Math.max(existing?.volume ?? 0, volume),
    fees: isToday ? fees : Math.max(existing?.fees ?? 0, fees),
    users: isToday ? users : Math.max(existing?.users ?? 0, users),
  };

  await env.DB.prepare(
    `INSERT INTO protocol_snaps (slug, day, tvl, volume, fees, users)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug, day) DO UPDATE SET
       tvl = excluded.tvl,
       volume = excluded.volume,
       fees = excluded.fees,
       users = excluded.users`,
  )
    .bind(slug, day, next.tvl, next.volume, next.fees, next.users)
    .run();
}

export async function listRankings(env: Env): Promise<RankingRow[]> {
  const { results } = await env.DB.prepare(`SELECT payload FROM protocol_latest`).all<{
    payload: string;
  }>();
  return (results ?? [])
    .map((r) => JSON.parse(r.payload) as RankingRow)
    .sort((a, b) => b.tvlUsd - a.tvlUsd);
}

export async function getRanking(env: Env, slug: string): Promise<RankingRow | null> {
  const row = await env.DB.prepare(`SELECT payload FROM protocol_latest WHERE slug = ?`)
    .bind(slug)
    .first<{ payload: string }>();
  return row ? (JSON.parse(row.payload) as RankingRow) : null;
}

export async function getDetail(env: Env, slug: string): Promise<DetailPayload | null> {
  const row = await env.DB.prepare(`SELECT payload FROM protocol_detail WHERE slug = ?`)
    .bind(slug)
    .first<{ payload: string }>();
  return row ? (JSON.parse(row.payload) as DetailPayload) : null;
}

export async function seriesFor(
  env: Env,
  slug: string,
  field: "tvl" | "volume" | "fees" | "users",
  days: number,
): Promise<Array<{ date: string; value: number }>> {
  const today = dayKey();
  const from = today - days + 1;
  const { results } = await env.DB.prepare(
    `SELECT day, ${field} AS value FROM protocol_snaps
     WHERE slug = ? AND day >= ?
     ORDER BY day ASC`,
  )
    .bind(slug, from)
    .all<{ day: number; value: number }>();

  const byDay = new Map((results ?? []).map((r) => [r.day, r.value]));
  const out: Array<{ date: string; value: number }> = [];
  let last = 0;
  for (let d = from; d <= today; d++) {
    const hit = byDay.get(d);
    if (field === "tvl") {
      if (hit != null) last = hit;
      out.push({ date: new Date(d * DAY_MS).toISOString().slice(0, 10), value: last });
    } else {
      out.push({
        date: new Date(d * DAY_MS).toISOString().slice(0, 10),
        value: hit ?? 0,
      });
    }
  }
  return out;
}

export async function changePct(
  env: Env,
  slug: string,
  field: "tvl" | "volume",
  current: number,
  daysAgo: number,
): Promise<number | undefined> {
  if (current <= 0) return undefined;
  const target = dayKey() - daysAgo;
  const row = await env.DB.prepare(
    `SELECT day, ${field} AS value FROM protocol_snaps
     WHERE slug = ? AND day <= ?
     ORDER BY day DESC LIMIT 1`,
  )
    .bind(slug, target)
    .first<{ day: number; value: number }>();
  if (!row || row.value <= 0) return undefined;
  // Snap must be close to the requested day (no "nearest ancient row")
  const slack = daysAgo <= 1 ? 0 : daysAgo <= 7 ? 2 : 5;
  if (target - row.day > slack) return undefined;
  const pct = ((current - row.value) / row.value) * 100;
  if (!Number.isFinite(pct)) return undefined;
  // Reject absurd jumps (bad snaps / incomplete history)
  if (Math.abs(pct) > 100) return undefined;
  return pct;
}

export async function chainTvlSeries(
  env: Env,
  days = 90,
): Promise<Array<{ date: string; value: number }>> {
  const today = dayKey();
  const from = today - days + 1;
  const { results } = await env.DB.prepare(
    `SELECT day, SUM(tvl) AS value FROM protocol_snaps WHERE day >= ? GROUP BY day ORDER BY day`,
  )
    .bind(from)
    .all<{ day: number; value: number }>();
  const byDay = new Map((results ?? []).map((r) => [r.day, r.value]));
  const out: Array<{ date: string; value: number }> = [];
  let last = 0;
  for (let d = from; d <= today; d++) {
    const hit = byDay.get(d);
    if (hit != null) last = hit;
    out.push({ date: new Date(d * DAY_MS).toISOString().slice(0, 10), value: last });
  }
  return out;
}

export async function saveEco(env: Env, payload: unknown) {
  const at = Date.now();
  await env.DB.prepare(
    `INSERT INTO eco_latest (id, payload, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(JSON.stringify(payload), at)
    .run();
}

export async function getEco(env: Env) {
  const row = await env.DB.prepare(`SELECT payload, updated_at FROM eco_latest WHERE id = 1`).first<{
    payload: string;
    updated_at: number;
  }>();
  if (!row) return null;
  return { ...(JSON.parse(row.payload) as Record<string, unknown>), updatedAt: row.updated_at };
}

export async function saveToken(env: Env, row: { address: string }, updatedAt = Date.now()) {
  const address = String(row.address).toLowerCase();
  const payload = { ...row, address, updatedAt };
  await env.DB.prepare(
    `INSERT INTO token_latest (address, payload, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(address) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(address, JSON.stringify(payload), updatedAt)
    .run();
}

async function migrateTokenBlob(env: Env) {
  const n = await env.DB.prepare(`SELECT COUNT(*) AS n FROM token_latest`).first<{ n: number }>();
  if ((n?.n ?? 0) > 0) return;
  let blob: { payload: string; updated_at: number } | null = null;
  try {
    blob = await env.DB.prepare(`SELECT payload, updated_at FROM tokens_latest WHERE id = 1`).first<{
      payload: string;
      updated_at: number;
    }>();
  } catch {
    return;
  }
  if (!blob) return;
  const items = (JSON.parse(blob.payload) as { items?: Array<{ address?: string }> }).items ?? [];
  for (const item of items) {
    if (!item.address) continue;
    await saveToken(env, item as { address: string }, blob.updated_at);
  }
}

export async function getTokens(env: Env): Promise<{ items: unknown[]; updatedAt: number } | null> {
  const { results } = await env.DB.prepare(`SELECT payload, updated_at FROM token_latest`).all<{
    payload: string;
    updated_at: number;
  }>();
  if (!results?.length) return null;
  const items = results
    .map((r) => JSON.parse(r.payload) as { interest?: number })
    .sort((a, b) => (b.interest ?? 0) - (a.interest ?? 0));
  return { items, updatedAt: Math.max(...results.map((r) => r.updated_at)) };
}

export async function saveWallets(env: Env, payload: { items: unknown[]; stats: unknown; updatedAt: number }) {
  await env.DB.prepare(
    `INSERT INTO wallets_latest (id, payload, updated_at)
     VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at`,
  )
    .bind(JSON.stringify(payload), payload.updatedAt)
    .run();
}

export async function getWallets(env: Env): Promise<{
  items: unknown[];
  stats: unknown;
  updatedAt: number;
} | null> {
  const row = await env.DB.prepare(`SELECT payload, updated_at FROM wallets_latest WHERE id = 1`).first<{
    payload: string;
    updated_at: number;
  }>();
  if (!row) return null;
  const parsed = JSON.parse(row.payload) as {
    items?: unknown[];
    stats?: unknown;
    updatedAt?: number;
  };
  return {
    items: parsed.items ?? [],
    stats: parsed.stats ?? null,
    updatedAt: parsed.updatedAt ?? row.updated_at,
  };
}

export async function saveTokenSnap(
  env: Env,
  address: string,
  day: number,
  price: number,
  mcap: number,
  holders: number,
) {
  const addr = address.toLowerCase();
  const today = dayKey();
  const existing = await env.DB.prepare(
    `SELECT price, mcap, holders FROM token_snaps WHERE address = ? AND day = ?`,
  )
    .bind(addr, day)
    .first<{ price: number; mcap: number; holders: number }>();

  const isToday = day === today;
  const nextPrice =
    isToday || !existing?.price
      ? price
      : price > 0
        ? price
        : existing.price;
  const nextMcap = isToday ? mcap : Math.max(existing?.mcap ?? 0, mcap);
  const nextHolders = isToday ? holders : Math.max(existing?.holders ?? 0, holders);

  await env.DB.prepare(
    `INSERT INTO token_snaps (address, day, price, mcap, holders)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(address, day) DO UPDATE SET
       price = excluded.price,
       mcap = excluded.mcap,
       holders = excluded.holders`,
  )
    .bind(addr, day, nextPrice, nextMcap, nextHolders)
    .run();
}

/** Force-write a historical price (ArcScan backfill) — does not max with stale zeros. */
export async function seedTokenSnapPrice(env: Env, address: string, day: number, price: number) {
  if (!Number.isFinite(price) || price <= 0) return;
  const addr = address.toLowerCase();
  await env.DB.prepare(
    `INSERT INTO token_snaps (address, day, price, mcap, holders)
     VALUES (?, ?, ?, 0, 0)
     ON CONFLICT(address, day) DO UPDATE SET price = excluded.price`,
  )
    .bind(addr, day, price)
    .run();
}

export async function tokenSeriesFor(
  env: Env,
  address: string,
  field: "price" | "mcap" | "holders",
  days: number,
): Promise<Array<{ date: string; value: number }>> {
  const today = dayKey();
  const from = today - days + 1;
  const { results } = await env.DB.prepare(
    `SELECT day, ${field} AS value FROM token_snaps
     WHERE address = ? AND day >= ?
     ORDER BY day ASC`,
  )
    .bind(address.toLowerCase(), from)
    .all<{ day: number; value: number }>();

  const byDay = new Map((results ?? []).map((r) => [r.day, r.value]));
  const out: Array<{ date: string; value: number }> = [];
  let last = 0;
  for (let d = from; d <= today; d++) {
    const hit = byDay.get(d);
    if (hit != null && hit > 0) last = hit;
    out.push({ date: new Date(d * DAY_MS).toISOString().slice(0, 10), value: last });
  }
  return out;
}

export async function tokenChangePct(
  env: Env,
  address: string,
  current: number,
  daysAgo: number,
): Promise<number | undefined> {
  if (current <= 0) return undefined;
  const target = dayKey() - daysAgo;
  const row = await env.DB.prepare(
    `SELECT day, price AS value FROM token_snaps
     WHERE address = ? AND day <= ? AND price > 0
     ORDER BY day DESC LIMIT 1`,
  )
    .bind(address.toLowerCase(), target)
    .first<{ day: number; value: number }>();
  if (!row || row.value <= 0) return undefined;
  const slack = daysAgo <= 1 ? 0 : daysAgo <= 7 ? 2 : 5;
  if (target - row.day > slack) return undefined;
  const pct = ((current - row.value) / row.value) * 100;
  if (!Number.isFinite(pct)) return undefined;
  // Memes can move hard; still reject nonsense
  if (Math.abs(pct) > 500) return undefined;
  return pct;
}

export async function setMeta(env: Env, key: string, value: string) {
  await env.DB.prepare(
    `INSERT INTO meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  )
    .bind(key, value)
    .run();
}

export async function getMeta(env: Env, key: string) {
  const row = await env.DB.prepare(`SELECT value FROM meta WHERE key = ?`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value;
}
