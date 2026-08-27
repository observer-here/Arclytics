import type { Env } from "../lib/env";
import { getWallets } from "./db";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const LIVE_MAX = 10;
const MOVERS_MAX = 100;
const MOVERS_BATCH = 5;
const MOVERS_DELAY_MS = 180;
const MOVERS_LIST = 5;
const DAY_MS = 86_400_000;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mapInBatches<T, R>(
  items: T[],
  batchSize: number,
  delayMs: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    out.push(...(await Promise.all(items.slice(i, i + batchSize).map(fn))));
    if (i + batchSize < items.length) await sleep(delayMs);
  }
  return out;
}

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
        await sleep(250);
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

/** Same as Address Summary: last day vs previous day (no 2-day skip). */
function changeFromHist(items?: Array<{ date?: string; value?: string }>, liveBal?: number | null) {
  const rows = (items ?? [])
    .map((d) => ({ date: String(d.date ?? ""), value: parseAmt(d.value) }))
    .filter((d) => d.date.length > 0 && Number.isFinite(d.value))
    .sort((a, b) => a.date.localeCompare(b.date));

  const spark24h = rows.map((r) => r.value).slice(-8);
  if (rows.length < 2) {
    return { change24h: null as number | null, delta24h: null as number | null, spark24h };
  }

  const prev = rows[rows.length - 2]!;
  const cur =
    liveBal != null && Number.isFinite(liveBal) && liveBal > 0
      ? liveBal
      : rows[rows.length - 1]!.value;
  if (!(prev.value > 0)) {
    return { change24h: null, delta24h: null, spark24h };
  }
  const delta24h = cur - prev.value;
  const change24h = (delta24h / prev.value) * 100;
  return { change24h, delta24h, spark24h };
}

function ageDaysFromHist(items?: Array<{ date?: string; value?: string }>) {
  const dates = (items ?? [])
    .map((d) => String(d.date ?? ""))
    .filter(Boolean)
    .sort();
  const first = dates[0];
  if (!first) return null;
  const t = new Date(`${first}T00:00:00.000Z`).getTime();
  if (!Number.isFinite(t) || t <= 0) return null;
  return Math.max(0, Math.floor((Date.now() - t) / DAY_MS));
}

async function liveOne(base: string, address: string) {
  const [tx, hist, profile] = await Promise.all([
    getJson<{ items?: Array<{ timestamp?: unknown }> }>(
      `${base}/addresses/${address}/transactions?items_count=1`,
    ),
    getJson<{ items?: Array<{ date?: string; value?: string }> }>(
      `${base}/addresses/${address}/coin-balance-history-by-day`,
    ),
    getJson<{ coin_balance?: string }>(`${base}/addresses/${address}`),
  ]);
  const ts = tx?.items?.[0]?.timestamp;
  const liveBal =
    profile?.coin_balance != null ? parseAmt(profile.coin_balance) : null;
  const { change24h, delta24h, spark24h } = changeFromHist(hist?.items, liveBal);
  return {
    address,
    lastActive: ts != null ? String(ts) : null,
    change24h,
    delta24h,
    spark24h,
  };
}

async function moverOne(base: string, address: string) {
  const [tx, hist, profile] = await Promise.all([
    getJson<{ items?: Array<{ timestamp?: unknown }> }>(
      `${base}/addresses/${address}/transactions?items_count=1`,
    ),
    getJson<{ items?: Array<{ date?: string; value?: string }> }>(
      `${base}/addresses/${address}/coin-balance-history-by-day`,
    ),
    getJson<{ coin_balance?: string }>(`${base}/addresses/${address}`),
  ]);
  const liveBal =
    profile?.coin_balance != null ? parseAmt(profile.coin_balance) : null;
  const { change24h, delta24h } = changeFromHist(hist?.items, liveBal);
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

/** Live ArcScan movers for D1 top-100 addresses — never uses client address list. */
export async function walletsMovers(env: Env) {
  const base = env.ARCSCAN_BASE.replace(/\/$/, "");
  const stored = await getWallets(env);
  const addrs = uniqAddrs(
    ((stored?.items ?? []) as Array<{ address?: string }>).map((w) => String(w.address ?? "")),
    MOVERS_MAX,
  );

  if (!addrs.length) {
    return {
      gainers: [],
      losers: [],
      insights: {
        netFlow24h: 0,
        avgAgeDays: 0,
        activeRate: 0,
        active24h: 0,
        sample: 0,
      },
    };
  }

  const items = await mapInBatches(addrs, MOVERS_BATCH, MOVERS_DELAY_MS, (a) =>
    moverOne(base, a),
  );

  const ranked = items.filter(
    (r): r is (typeof items)[number] & { change24h: number; delta24h: number } =>
      r.change24h != null && r.delta24h != null,
  );

  // Always 5 + 5 from full top-100: highest $ deltas / lowest $ deltas.
  const byDelta = [...ranked].sort((a, b) => b.delta24h - a.delta24h);
  const gainers = byDelta.slice(0, MOVERS_LIST).map((r) => ({
    address: r.address,
    change: r.change24h,
    delta: r.delta24h,
  }));
  const gainerSet = new Set(gainers.map((g) => g.address));
  const losers = [...byDelta]
    .reverse()
    .filter((r) => !gainerSet.has(r.address))
    .slice(0, MOVERS_LIST)
    .map((r) => ({ address: r.address, change: r.change24h, delta: r.delta24h }));

  const withDelta = ranked;
  const ages = items
    .map((r) => r.ageDays)
    .filter((n): n is number => n != null && n >= 0);
  const active24h = items.filter((r) => r.active24h).length;

  return {
    gainers,
    losers,
    insights: {
      netFlow24h: withDelta.reduce((s, r) => s + (r.delta24h ?? 0), 0),
      avgAgeDays: ages.length
        ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length)
        : 0,
      activeRate: items.length ? (active24h / items.length) * 100 : 0,
      active24h,
      sample: items.length,
    },
  };
}
