import type { Env } from "../lib/env";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const LIVE_MAX = 10;
const MOVERS_MAX = 20;
const DAY_MS = 86_400_000;

function parseAmt(raw: unknown, decimals = 18) {
  const v = Number(raw ?? 0);
  return Number.isFinite(v) ? v / 10 ** decimals : 0;
}

function uniqAddrs(raw: string[], max: number) {
  return [
    ...new Set(
      raw
        .map((a) => a.trim().toLowerCase())
        .filter((a) => ADDR_RE.test(a)),
    ),
  ].slice(0, max);
}

async function getJson<T>(url: string): Promise<T | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (res.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 200));
        continue;
      }
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      if (attempt === 0) continue;
      return null;
    }
  }
  return null;
}

function changeFromHist(items?: Array<{ date?: string; value?: string }>) {
  const spark = (items ?? [])
    .map((d) => parseAmt(d.value))
    .filter((v) => Number.isFinite(v));
  let change24h: number | null = null;
  let delta24h: number | null = null;
  if (spark.length >= 2) {
    const prev = spark[spark.length - 2]!;
    const cur = spark[spark.length - 1]!;
    if (prev > 0) {
      delta24h = cur - prev;
      change24h = (delta24h / prev) * 100;
    }
  }
  return { change24h, delta24h, spark24h: spark.length ? spark.slice(-8) : [] };
}

function ageDaysFromHist(items?: Array<{ date?: string; value?: string }>) {
  const first = items?.[0]?.date;
  if (!first) return null;
  const t = new Date(`${first}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

async function liveOne(base: string, address: string) {
  const [tx, hist] = await Promise.all([
    getJson<{ items?: Array<{ timestamp?: unknown }> }>(
      `${base}/addresses/${address}/transactions?items_count=1`,
    ),
    getJson<{ items?: Array<{ date?: string; value?: string }> }>(
      `${base}/addresses/${address}/coin-balance-history-by-day`,
    ),
  ]);
  const ts = tx?.items?.[0]?.timestamp;
  const { change24h, delta24h, spark24h } = changeFromHist(hist?.items);
  return {
    address,
    lastActive: ts != null ? String(ts) : null,
    change24h,
    delta24h,
    spark24h,
  };
}

async function moverOne(base: string, address: string) {
  const [tx, hist] = await Promise.all([
    getJson<{ items?: Array<{ timestamp?: unknown }> }>(
      `${base}/addresses/${address}/transactions?items_count=1`,
    ),
    getJson<{ items?: Array<{ date?: string; value?: string }> }>(
      `${base}/addresses/${address}/coin-balance-history-by-day`,
    ),
  ]);
  const { change24h, delta24h } = changeFromHist(hist?.items);
  const ts = tx?.items?.[0]?.timestamp;
  const lastMs = ts != null ? new Date(String(ts)).getTime() : NaN;
  return {
    address,
    change24h,
    delta24h,
    ageDays: ageDaysFromHist(hist?.items),
    active24h: Number.isFinite(lastMs) && Date.now() - lastMs < DAY_MS,
  };
}

export async function walletsLive(env: Env, raw: string[]) {
  const base = env.ARCSCAN_BASE.replace(/\/$/, "");
  const addrs = uniqAddrs(raw, LIVE_MAX);
  const items = await Promise.all(addrs.map((a) => liveOne(base, a)));
  return { items };
}

export async function walletsMovers(env: Env, raw: string[]) {
  const base = env.ARCSCAN_BASE.replace(/\/$/, "");
  const addrs = uniqAddrs(raw, MOVERS_MAX);
  const items = await Promise.all(addrs.map((a) => moverOne(base, a)));
  const ranked = items.filter(
    (r): r is (typeof items)[number] & { change24h: number; delta24h: number } =>
      r.change24h != null && r.delta24h != null,
  );

  const gainers = ranked
    .filter((r) => r.delta24h > 0)
    .sort((a, b) => b.change24h - a.change24h)
    .slice(0, 5)
    .map((r) => ({ address: r.address, change: r.change24h, delta: r.delta24h }));

  const losers = ranked
    .filter((r) => r.delta24h < 0)
    .sort((a, b) => a.change24h - b.change24h)
    .slice(0, 5)
    .map((r) => ({ address: r.address, change: r.change24h, delta: r.delta24h }));

  const ages = items
    .map((r) => r.ageDays)
    .filter((n): n is number => n != null && n >= 0);
  const active24h = items.filter((r) => r.active24h).length;

  return {
    gainers,
    losers,
    insights: {
      netFlow24h: ranked.reduce((s, r) => s + r.delta24h, 0),
      avgAgeDays: ages.length
        ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length)
        : 0,
      activeRate: items.length ? (active24h / items.length) * 100 : 0,
      active24h,
      sample: items.length,
    },
  };
}
