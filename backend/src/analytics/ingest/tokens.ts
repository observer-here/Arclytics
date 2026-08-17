import { CURATED_TOKENS, RESERVE_USD, tokenLogo, type CuratedToken } from "@arclytics/chain";
import type { Arcscan } from "../arcscan";
import {
  dayKey,
  getMeta,
  getTokens,
  saveTokenSnap,
  saveTokens,
  seedTokenSnapPrice,
  setMeta,
  tokenChangePct,
} from "../db";
import type { Env } from "../../lib/env";

export type TokenRow = {
  address: string;
  name: string;
  symbol: string;
  holders: number;
  transfers: number;
  interest: number;
  iconUrl?: string;
  price: number | null;
  marketCap: number | null;
  volume24h: number | null;
  change24h?: number | null;
  change7d?: number | null;
  category: string;
  protocol: string;
  amm: string;
  blurb?: string;
};

function interestScore(holders: number, transfers: number) {
  return holders + Math.log10(transfers + 1) * 50_000;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

const DAY_MS = 86_400_000;

function isSwapMethod(method: unknown) {
  const m = String(method ?? "").toLowerCase();
  return (
    m.includes("swap") ||
    m.includes("exchange") ||
    m.includes("trade") ||
    m.includes("exactinput") ||
    m.includes("exactoutput")
  );
}

/**
 * Real 24h USD volume from ArcScan `/tokens/{addr}/transfers`.
 * ArcScan leaves `volume_24h` null — we sum transfer amounts × price.
 * Prefer swap methods when enough swaps appear (CMC-style trading volume);
 * otherwise use all transfers. Extrapolate if sample window < 24h (cap 72×).
 */
async function volume24hUsd(
  arc: Arcscan,
  address: string,
  price: number,
  maxPages = 5,
): Promise<number | null> {
  if (!(price > 0) || price > 1e5) return null;
  const cutoff = Date.now() - DAY_MS;
  let params: Record<string, string | number> | null = null;
  let allSum = 0;
  let swapSum = 0;
  let swapN = 0;
  let newest = 0;
  let oldest = Number.POSITIVE_INFINITY;
  let covered = false;

  for (let page = 0; page < maxPages; page++) {
    let batch;
    try {
      batch = await arc.tokenTransfers(address, params);
    } catch {
      break;
    }
    const items = batch.items ?? [];
    if (!items.length) break;

    for (const item of items) {
      const ts = item.timestamp ? new Date(String(item.timestamp)).getTime() : 0;
      if (!ts) continue;
      if (ts < cutoff) {
        covered = true;
        break;
      }
      newest = Math.max(newest, ts);
      oldest = Math.min(oldest, ts);

      const total = item.total as { value?: string; decimals?: string } | undefined;
      const token = item.token as { decimals?: string } | undefined;
      const dec = Number(total?.decimals ?? token?.decimals ?? 18);
      const amount = Number(total?.value ?? 0) / 10 ** dec;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      if (amount * price < 0.01) continue;

      allSum += amount;
      if (isSwapMethod(item.method)) {
        swapSum += amount;
        swapN += 1;
      }
    }

    if (covered || !batch.nextPageParams) break;
    params = batch.nextPageParams as Record<string, string | number>;
  }

  let tokenVol = swapN >= 5 ? swapSum : allSum;
  if (tokenVol <= 0) return null;

  if (!covered && newest > oldest && Number.isFinite(oldest)) {
    const span = Math.max(newest - oldest, 60_000);
    const scale = Math.min(DAY_MS / span, 72);
    if (scale > 1.05) tokenVol *= scale;
  }

  const usd = tokenVol * price;
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

/** DEX trading volume = stablecoin (USDC/EURC) flow through a pool in 24h. */
async function poolStableVolume24h(
  arc: Arcscan,
  poolAddress: string,
  maxPages = 5,
): Promise<number | null> {
  const cutoff = Date.now() - DAY_MS;
  let params: Record<string, string | number> | null = null;
  let sum = 0;
  let newest = 0;
  let oldest = Number.POSITIVE_INFINITY;
  let covered = false;

  for (let page = 0; page < maxPages; page++) {
    let batch;
    try {
      batch = await arc.addressTokenTransfers(poolAddress, params);
    } catch {
      break;
    }
    const items = batch.items ?? [];
    if (!items.length) break;

    for (const item of items) {
      const ts = item.timestamp ? new Date(String(item.timestamp)).getTime() : 0;
      if (!ts) continue;
      if (ts < cutoff) {
        covered = true;
        break;
      }
      newest = Math.max(newest, ts);
      oldest = Math.min(oldest, ts);

      const token = item.token as { address_hash?: string; decimals?: string } | undefined;
      const addr = (token?.address_hash ?? "").toLowerCase();
      const px = RESERVE_USD[addr];
      if (px == null) continue;
      const total = item.total as { value?: string; decimals?: string } | undefined;
      const dec = Number(total?.decimals ?? token?.decimals ?? 18);
      const amount = Number(total?.value ?? 0) / 10 ** dec;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      sum += amount * px;
    }

    if (covered || !batch.nextPageParams) break;
    params = batch.nextPageParams as Record<string, string | number>;
  }

  if (sum <= 0) return null;
  // Pool sees both legs of a swap often; ≈ 2× one-sided flow → half for spot volume
  let vol = sum / 2;
  if (!covered && newest > oldest && Number.isFinite(oldest)) {
    const span = Math.max(newest - oldest, 60_000);
    // Pool flow is dense — keep extrapolation tight (same idea as protocol ingest)
    const scale = Math.min(DAY_MS / span, 12);
    if (scale > 1.05) vol *= scale;
  }
  return Number.isFinite(vol) && vol > 0 ? vol : null;
}

async function resolveVolume24h(
  arc: Arcscan,
  meta: CuratedToken,
  address: string,
  price: number | null,
): Promise<number | null> {
  if (meta.spotPool) {
    const poolVol = await poolStableVolume24h(arc, meta.spotPool);
    if (poolVol != null) return poolVol;
  }
  if (meta.fromReserves) {
    const poolVol = await poolStableVolume24h(arc, address);
    if (poolVol != null) return poolVol;
  }
  if (price != null && price > 0) return volume24hUsd(arc, address, price);
  return null;
}

type TokBal = {
  value?: string | number;
  token?: { address_hash?: string; decimals?: string };
};

async function lpPrice(arc: Arcscan, address: string) {
  const bals = await arc.addressTokens(address).catch(() => ({ items: [] as TokBal[] }));
  const tok = await arc.token(address).catch(() => null);
  if (!tok || (tok as { message?: string }).message) {
    return { price: null as number | null, supply: 0, tvlUsd: 0 };
  }
  const decimals = Number(tok.decimals ?? 18);
  const supply = Number(tok.total_supply ?? 0) / 10 ** decimals;
  let pricedUsd = 0;
  let pricedLegs = 0;
  let unpriced = 0;
  for (const item of bals.items ?? []) {
    const addr = (item.token?.address_hash ?? "").toLowerCase();
    const dec = Number(item.token?.decimals ?? 18);
    const amt = Number(item.value ?? 0) / 10 ** dec;
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const px = RESERVE_USD[addr];
    if (px != null) {
      pricedUsd += amt * px;
      pricedLegs += 1;
    } else unpriced += 1;
  }
  let tvlUsd = pricedUsd;
  if (pricedUsd > 0 && unpriced > 0 && pricedLegs === 1) tvlUsd = pricedUsd * 2;
  if (!Number.isFinite(supply) || supply < 1e-8 || tvlUsd <= 0) {
    return { price: null, supply, tvlUsd };
  }
  const price = tvlUsd / supply;
  if (!Number.isFinite(price) || price <= 0 || price > 1e9) {
    return { price: null, supply, tvlUsd };
  }
  return { price, supply, tvlUsd };
}

async function spotPrice(arc: Arcscan, tokenAddress: string, poolAddress: string) {
  const bals = await arc.addressTokens(poolAddress).catch(() => ({ items: [] as TokBal[] }));
  const token = tokenAddress.toLowerCase();
  let tokenAmt = 0;
  let pricedUsd = 0;
  for (const item of bals.items ?? []) {
    const addr = (item.token?.address_hash ?? "").toLowerCase();
    const dec = Number(item.token?.decimals ?? 18);
    const amt = Number(item.value ?? 0) / 10 ** dec;
    if (!Number.isFinite(amt) || amt <= 0) continue;
    if (addr === token) tokenAmt = amt;
    const px = RESERVE_USD[addr];
    if (px != null) pricedUsd += amt * px;
  }
  if (tokenAmt <= 0 || pricedUsd <= 0) return null;
  const price = pricedUsd / tokenAmt;
  if (!Number.isFinite(price) || price <= 0 || price > 1e9) return null;
  return price;
}

/** Native USDC daily balances at a pool/LP (~10d on ArcScan). */
async function usdcHistoryByDay(arc: Arcscan, address: string) {
  const hist = await arc.coinBalanceHistoryByDay(address).catch(() => ({ items: [] as Array<{ date?: string; value?: string }> }));
  const out: Array<{ day: number; usdc: number }> = [];
  for (const item of hist.items ?? []) {
    const date = String(item.date ?? "");
    if (!date) continue;
    const day = dayKey(new Date(`${date}T12:00:00Z`).getTime());
    const usdc = Number(String(item.value ?? "0")) / 1e18;
    if (!Number.isFinite(usdc) || usdc <= 0) continue;
    out.push({ day, usdc });
  }
  return out.sort((a, b) => a.day - b.day);
}

/**
 * Seed ~10d price snaps from ArcScan native-USDC history.
 * - spot (UniV2): constant-product → price ∝ usdc²
 * - LP / vault share: price ∝ usdc (TVL proxy / supply)
 * - peg: flat $1
 */
async function seedPriceHistory(
  env: Env,
  arc: Arcscan,
  meta: CuratedToken,
  tokenAddress: string,
  currentPrice: number,
) {
  if (meta.pegUsd && !meta.fromReserves && !meta.spotPool) {
    const today = dayKey();
    for (let i = 0; i <= 7; i++) {
      await seedTokenSnapPrice(env, tokenAddress, today - i, 1);
    }
    return;
  }

  const histAddr = meta.spotPool ?? (meta.fromReserves ? meta.address : null);
  if (!histAddr || !(currentPrice > 0)) return;

  const series = await usdcHistoryByDay(arc, histAddr);
  if (series.length < 2) return;
  const last = series[series.length - 1]?.usdc ?? 0;
  if (last <= 0) return;

  const isSpot = Boolean(meta.spotPool);
  for (const h of series) {
    const ratio = h.usdc / last;
    if (!Number.isFinite(ratio) || ratio <= 0) continue;
    const price = isSpot ? currentPrice * ratio * ratio : currentPrice * ratio;
    if (!Number.isFinite(price) || price <= 0 || price > 1e9) continue;
    await seedTokenSnapPrice(env, tokenAddress, h.day, price);
  }
}

async function buildRow(env: Env, arc: Arcscan, meta: CuratedToken): Promise<TokenRow | null> {
  const [tok, counters] = await Promise.all([
    arc.token(meta.address).catch(() => null),
    arc.tokenCounters(meta.address).catch(() => null),
  ]);
  if (!tok || (tok as { message?: string }).message) return null;
  const name = String(tok.name ?? "");
  const symbol = String(tok.symbol ?? "");
  if (!name && !symbol) return null;

  const address = String(tok.address_hash ?? meta.address);
  const rate = tok.exchange_rate != null ? Number(tok.exchange_rate) : null;
  let price: number | null =
    rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
  let marketCap: number | null =
    tok.circulating_market_cap != null && Number(tok.circulating_market_cap) > 0
      ? Number(tok.circulating_market_cap)
      : null;

  if (price == null && meta.fromReserves) {
    const lp = await lpPrice(arc, address);
    price = lp.price;
    if (price != null && lp.supply > 0) marketCap = price * lp.supply;
  }
  if (price == null && meta.spotPool) {
    price = await spotPrice(arc, address, meta.spotPool);
    const dec = Number(tok.decimals ?? 18);
    const supply = Number(tok.total_supply ?? 0) / 10 ** dec;
    if (price != null && supply > 0) marketCap = price * supply;
  }
  if (price == null && meta.pegUsd) price = 1;

  const holders = Number(counters?.token_holders_count ?? tok.holders_count ?? 0);
  const transfers = Number(counters?.transfers_count ?? 0);
  const listedVol = tok.volume_24h != null ? Number(tok.volume_24h) : null;
  let volume24h: number | null =
    listedVol != null && Number.isFinite(listedVol) && listedVol > 0 ? listedVol : null;
  if (volume24h == null) {
    volume24h = await resolveVolume24h(arc, meta, address, price);
  }

  if (price != null && price > 0) {
    await seedPriceHistory(env, arc, meta, address, price);
    await saveTokenSnap(env, address, dayKey(), price, marketCap ?? 0, holders);
  }

  let change24h: number | null = null;
  let change7d: number | null = null;
  if (price != null && price > 0) {
    if (meta.pegUsd && !meta.fromReserves && !meta.spotPool) {
      change24h = 0;
      change7d = 0;
    } else {
      change24h = (await tokenChangePct(env, address, price, 1)) ?? null;
      change7d = (await tokenChangePct(env, address, price, 7)) ?? null;
    }
  }

  return {
    address,
    name,
    symbol,
    holders,
    transfers,
    interest: interestScore(holders, transfers),
    iconUrl: tokenLogo(address) ?? (tok.icon_url ? String(tok.icon_url) : undefined),
    price,
    marketCap,
    volume24h,
    change24h,
    change7d,
    category: meta.category,
    protocol: meta.protocol,
    amm: meta.amm,
    blurb: meta.blurb,
  };
}

/** Ingest curated tokens into D1 (same pattern as protocol rankings). */
export async function ingestTokens(env: Env, arc: Arcscan) {
  const items: TokenRow[] = [];
  for (const meta of CURATED_TOKENS) {
    try {
      const row = await buildRow(env, arc, meta);
      if (row) items.push(row);
    } catch {
      // soft-fail per token
    }
    await sleep(100);
  }

  items.sort((a, b) => b.interest - a.interest);
  const prev = await getTokens(env);
  if (!items.length && prev?.items?.length) {
    return { ok: true, count: 0, kept: true };
  }

  const updatedAt = Date.now();
  await saveTokens(env, { items, updatedAt });
  await setMeta(env, "last_tokens_ingest", String(updatedAt));
  return { ok: true, count: items.length };
}

export async function maybeIngestTokens(env: Env, arc: Arcscan, minAgeMs = 10 * 60_000) {
  const last = Number((await getMeta(env, "last_tokens_ingest")) ?? "0") || 0;
  if (Date.now() - last < minAgeMs) return { skipped: true, last };
  return ingestTokens(env, arc);
}
