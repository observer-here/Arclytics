import type { Env } from "./env";

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
  updatedAt: number;
};

const DAY_MS = 86_400_000;

export function dayKey(ts = Date.now()) {
  return Math.floor(ts / DAY_MS);
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
  const next = {
    tvl: isToday ? tvl : Math.max(existing?.tvl ?? 0, tvl),
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
    `SELECT ${field} AS value FROM protocol_snaps
     WHERE slug = ? AND day <= ?
     ORDER BY day DESC LIMIT 1`,
  )
    .bind(slug, target)
    .first<{ value: number }>();
  if (!row || row.value <= 0) return undefined;
  return ((current - row.value) / row.value) * 100;
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
