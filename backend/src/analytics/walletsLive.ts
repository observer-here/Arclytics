import type { Env } from "../lib/env";

const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;
const MAX = 10;

function parseAmt(raw: unknown, decimals = 18) {
  const v = Number(raw ?? 0);
  return Number.isFinite(v) ? v / 10 ** decimals : 0;
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
  const spark = (hist?.items ?? [])
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

  return {
    address,
    lastActive: ts != null ? String(ts) : null,
    change24h,
    delta24h,
    spark24h: spark.length ? spark.slice(-8) : [],
  };
}

export async function walletsLive(env: Env, raw: string[]) {
  const base = env.ARCSCAN_BASE.replace(/\/$/, "");
  const addrs = [
    ...new Set(
      raw
        .map((a) => a.trim().toLowerCase())
        .filter((a) => ADDR_RE.test(a)),
    ),
  ].slice(0, MAX);

  const items = await Promise.all(addrs.map((a) => liveOne(base, a)));
  return { items };
}
