import { addresses } from "@arclytics/chain";
import { priceUsd, sumTvlUsd, toNumber } from "@arclytics/math";
import { protocols } from "@arclytics/protocols";
import type { ProtocolConfig } from "@arclytics/types";
import type { Arcscan, PageParams } from "./arcscan";
import {
  changePct,
  dayKey,
  getDetail,
  getRanking,
  listRankings,
  saveDetail,
  saveEco,
  saveRanking,
  saveSnap,
  seriesFor,
  setMeta,
  type DetailPayload,
  type RankingRow,
} from "./db";
import type { Env } from "./env";

const DAY_MS = 86_400_000;
const HIST_DAYS = 90;
const SERIES_DAYS = 365;
const TVL_ROLES = new Set(["vault", "pool", "router", "lending_pool", "bridge"]);
const ACTIVE_SLUGS = new Set(protocols.map((p) => p.slug));

function emptyDays(n: number) {
  return new Array<number>(n).fill(0);
}

async function activeRankings(env: Env): Promise<RankingRow[]> {
  return (await listRankings(env))
    .filter((r) => ACTIVE_SLUGS.has(r.slug))
    .sort((a, b) => b.tvlUsd - a.tvlUsd);
}

async function rebuildEco(env: Env, stableMcap = 0) {
  const rankings = await activeRankings(env);
  for (let i = 0; i < rankings.length; i++) {
    const d = await getDetail(env, rankings[i].slug);
    if (!d) continue;
    d.rank = i + 1;
    await saveDetail(env, rankings[i].slug, d);
  }
  await saveEco(env, {
    rows: rankings.map((r) => ({
      slug: r.slug,
      name: r.name,
      category: r.category,
      tvlUsd: r.tvlUsd,
      change24h: r.change24h,
      change7d: r.change7d,
      change1m: r.change1m,
      volume24h: r.volume24h,
      fees24h: r.fees24h,
      mcapTvl: r.mcapTvl,
      age: r.age,
      spark7d: r.spark7d,
    })),
    spark: rankings[0]?.spark7d ?? [],
    stats: {
      tvlUsd: rankings.reduce((s, r) => s + r.tvlUsd, 0),
      tvlChange: weightedChange(rankings),
      volume24h: rankings.reduce((s, r) => s + (r.volume24h ?? 0), 0),
      fees24h: rankings.reduce((s, r) => s + (r.fees24h ?? 0), 0),
      activeUsers: rankings.reduce((s, r) => s + (r.activeUsers24h ?? 0), 0),
      protocols: rankings.length,
      stableMcap,
    },
  });
  return rankings;
}

function toPoints(buckets: number[], days: number) {
  const today = dayKey();
  const out: Array<{ date: string; value: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = today - i;
    const idx = buckets.length - 1 - i;
    out.push({
      date: new Date(d * DAY_MS).toISOString().slice(0, 10),
      value: idx >= 0 ? buckets[idx] ?? 0 : 0,
    });
  }
  return out;
}

function pointsFromMap(
  byDay: Map<number, number>,
  days: number,
  mode: "stock" | "flow",
): Array<{ date: string; value: number }> {
  const today = dayKey();
  const out: Array<{ date: string; value: number }> = [];
  let last = 0;
  let seen = false;
  for (let i = days - 1; i >= 0; i--) {
    const d = today - i;
    const hit = byDay.get(d);
    if (mode === "stock") {
      if (hit != null) {
        last = hit;
        seen = true;
      }
      out.push({
        date: new Date(d * DAY_MS).toISOString().slice(0, 10),
        value: seen ? last : 0,
      });
    } else {
      out.push({
        date: new Date(d * DAY_MS).toISOString().slice(0, 10),
        value: hit ?? 0,
      });
    }
  }
  return out;
}

function formatAge(createdAt: number) {
  const days = Math.max(0, Math.floor((Date.now() - createdAt) / DAY_MS));
  if (days < 60) return `${days}d`;
  const mo = Math.floor(days / 30);
  if (mo < 24) return `${mo} mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function pctFromNet(tvl: number, net: number): number | undefined {
  const prev = tvl - net;
  if (prev <= 0 || !Number.isFinite(prev)) return undefined;
  return (net / prev) * 100;
}

function tvlContracts(p: ProtocolConfig) {
  const preferred = p.contracts.filter((c) => TVL_ROLES.has(c.role));
  return (preferred.length ? preferred : p.contracts).slice(0, 12);
}

function transferPages(p: ProtocolConfig) {
  if (p.slug === "xylonet" || p.slug === "synthra") return 18;
  if (p.slug === "lunex" || p.slug === "defi-on-arc" || p.slug === "flowswap") return 12;
  if (p.category === "bridge" || p.slug === "payx") return 8;
  return 6;
}

function tvlFromNets(current: number, netBuckets: number[]) {
  const out = emptyDays(netBuckets.length);
  let tvl = current;
  for (let i = netBuckets.length - 1; i >= 0; i--) {
    out[i] = Math.max(0, tvl);
    tvl -= netBuckets[i];
  }
  return out;
}

async function protocolTvl(arc: Arcscan, p: ProtocolConfig) {
  const contracts = tvlContracts(p);
  const tracked = new Set(p.tvlTokens.map((t) => t.toLowerCase()));
  const batches = await Promise.all(
    contracts.map(async (c) => {
      try {
        const tokens = await arc.addressTokens(c.address);
        const out = [];
        for (const item of tokens.items ?? []) {
          const token = item.token as { address_hash?: string; decimals?: string } | undefined;
          const address = (token?.address_hash ?? "").toLowerCase();
          if (!tracked.has(address)) continue;
          out.push({
            token: address,
            raw: String(item.value ?? "0"),
            decimals: Number(token?.decimals ?? 18),
          });
        }
        return out;
      } catch {
        return [];
      }
    }),
  );
  return sumTvlUsd(batches.flat());
}

async function protocolAge(arc: Arcscan, p: ProtocolConfig) {
  const primary = p.contracts[0];
  if (!primary) return undefined;
  try {
    const info = await arc.address(primary.address);
    const hash = String(info.creation_transaction_hash ?? "");
    if (!hash) return undefined;
    const tx = await arc.transaction(hash);
    const ts = tx.timestamp ? new Date(String(tx.timestamp)).getTime() : 0;
    return ts ? formatAge(ts) : undefined;
  } catch {
    return undefined;
  }
}

async function sampleActivity(arc: Arcscan, p: ProtocolConfig) {
  const tracked = new Set(p.tvlTokens.map((t) => t.toLowerCase()));
  const now = Date.now();
  const cutoff24 = now - DAY_MS;
  const cutoffHist = now - HIST_DAYS * DAY_MS;
  const volBuckets = emptyDays(HIST_DAYS);
  const netBuckets = emptyDays(HIST_DAYS);
  const txBuckets = emptyDays(HIST_DAYS);
  const transferBuckets = emptyDays(HIST_DAYS);
  const userBuckets = emptyDays(HIST_DAYS);
  const users24 = new Set<string>();
  const usersByDay = Array.from({ length: HIST_DAYS }, () => new Set<string>());
  const contracts = p.contracts.slice(0, 6);
  const maxPages = transferPages(p);

  let newest24 = 0;
  let oldest24 = Number.POSITIVE_INFINITY;
  let covered24 = false;

  await Promise.all(
    contracts.map(async (c) => {
      const addr = c.address.toLowerCase();
      let params: PageParams = null;
      let hitHist = false;

      for (let page = 0; page < maxPages; page++) {
        let batch;
        try {
          batch = await arc.addressTokenTransfers(c.address, params);
        } catch {
          break;
        }
        if (!batch.items.length) break;

        for (const item of batch.items) {
          const ts = item.timestamp ? new Date(String(item.timestamp)).getTime() : 0;
          if (!ts || ts < cutoffHist) {
            hitHist = true;
            covered24 = true;
            break;
          }

          const dayIdx = Math.min(HIST_DAYS - 1, Math.max(0, Math.floor((now - ts) / DAY_MS)));
          const bucket = HIST_DAYS - 1 - dayIdx;
          transferBuckets[bucket] += 1;

          const token = item.token as { address_hash?: string } | undefined;
          const tokenAddr = (token?.address_hash ?? "").toLowerCase();
          if (!tracked.has(tokenAddr)) continue;
          const total = item.total as { value?: string; decimals?: string } | undefined;
          const amount = toNumber(String(total?.value ?? "0"), Number(total?.decimals ?? 18));
          const usd = amount * priceUsd(tokenAddr);
          if (usd <= 0) continue;
          volBuckets[bucket] += usd;

          const from = (item.from as { hash?: string } | undefined)?.hash?.toLowerCase();
          const to = (item.to as { hash?: string } | undefined)?.hash?.toLowerCase();
          if (to === addr) netBuckets[bucket] += usd;
          else if (from === addr) netBuckets[bucket] -= usd;

          for (const w of [from, to]) {
            if (!w || w === addr) continue;
            usersByDay[bucket].add(w);
            if (ts >= cutoff24) users24.add(w);
          }

          if (ts >= cutoff24) {
            newest24 = Math.max(newest24, ts);
            oldest24 = Math.min(oldest24, ts);
          } else {
            covered24 = true;
          }
        }

        if (hitHist || !batch.nextPageParams) break;
        // Prefer finishing 24h window before early exit
        if (covered24 && page >= Math.min(maxPages, 20) && dayDepth(volBuckets) >= 7) break;
        params = batch.nextPageParams;
      }

      params = null;
      for (let page = 0; page < Math.min(12, maxPages); page++) {
        let batch;
        try {
          batch = await arc.addressTransactions(c.address, params);
        } catch {
          break;
        }
        if (!batch.items.length) break;
        let older = false;
        for (const item of batch.items) {
          const ts = item.timestamp ? new Date(String(item.timestamp)).getTime() : 0;
          if (!ts || ts < cutoffHist) {
            older = true;
            break;
          }
          const dayIdx = Math.min(HIST_DAYS - 1, Math.max(0, Math.floor((now - ts) / DAY_MS)));
          const bucket = HIST_DAYS - 1 - dayIdx;
          txBuckets[bucket] += 1;
          const from = item.from as { hash?: string } | string | undefined;
          const fromHash = (typeof from === "string" ? from : from?.hash)?.toLowerCase();
          if (fromHash && fromHash !== addr) {
            usersByDay[bucket].add(fromHash);
            if (ts >= cutoff24) users24.add(fromHash);
          }
        }
        if (older || !batch.nextPageParams) break;
        params = batch.nextPageParams;
      }
    }),
  );

  for (let i = 0; i < HIST_DAYS; i++) userBuckets[i] = usersByDay[i].size;

  let volume24h = volBuckets[HIST_DAYS - 1] ?? 0;
  if (!covered24 && newest24 > oldest24 && Number.isFinite(oldest24)) {
    const span = Math.max(newest24 - oldest24, 60_000);
    // Cap extrapolation — never invent >8x from a thin sample window
    const scale = Math.min(DAY_MS / span, 8);
    if (scale > 1.05) volume24h *= scale;
  }

  const net24 = netBuckets[HIST_DAYS - 1] ?? 0;
  const net7 = netBuckets.slice(HIST_DAYS - 7).reduce((s, v) => s + v, 0);

  return {
    volBuckets,
    netBuckets,
    txBuckets,
    transferBuckets,
    userBuckets,
    volume24h,
    net24,
    net7,
    activeUsers24h: users24.size,
    spark7d: volBuckets.slice(HIST_DAYS - 7),
  };
}

function dayDepth(volBuckets: number[]) {
  let n = 0;
  for (let i = volBuckets.length - 1; i >= 0; i--) {
    if (volBuckets[i] > 0) n += 1;
    else if (n > 0) break;
  }
  return n;
}

async function contractTvls(arc: Arcscan, p: ProtocolConfig) {
  const tracked = new Set(p.tvlTokens.map((t) => t.toLowerCase()));
  return Promise.all(
    p.contracts.map(async (c) => {
      let tvlUsd = 0;
      let txs = 0;
      let transfers = 0;
      try {
        const [tokens, counters] = await Promise.all([
          arc.addressTokens(c.address),
          arc.addressCounters(c.address).catch(() => null),
        ]);
        txs = Number(counters?.transactions_count ?? 0);
        transfers = Number(counters?.token_transfers_count ?? 0);
        for (const item of tokens.items ?? []) {
          const token = item.token as { address_hash?: string; decimals?: string } | undefined;
          const address = (token?.address_hash ?? "").toLowerCase();
          if (!tracked.has(address)) continue;
          const amount = toNumber(String(item.value ?? "0"), Number(token?.decimals ?? 18));
          tvlUsd += amount * priceUsd(address);
        }
      } catch {
        // skip
      }
      return {
        address: c.address,
        label: c.label ?? c.role,
        role: c.role,
        tvlUsd,
        txs,
        transfers,
      };
    }),
  );
}

async function recentTxs(arc: Arcscan, p: ProtocolConfig) {
  const items: Array<Record<string, unknown>> = [];
  for (const c of p.contracts.slice(0, 4)) {
    try {
      const page = await arc.addressTransactions(c.address);
      for (const tx of page.items.slice(0, 10)) {
        items.push({ ...tx, _contract: c.label ?? c.role });
      }
    } catch {
      // skip
    }
  }
  return items
    .sort((a, b) => {
      const ta = a.timestamp ? new Date(String(a.timestamp)).getTime() : 0;
      const tb = b.timestamp ? new Date(String(b.timestamp)).getTime() : 0;
      return tb - ta;
    })
    .slice(0, 12);
}

function buildPairs(
  contracts: Array<{ label: string; role: string; tvlUsd: number }>,
  volume24h: number,
  fees24h: number,
) {
  const pools = contracts.filter((c) => (c.role === "pool" || c.role === "vault") && c.tvlUsd > 0);
  if (!pools.length) return [] as Array<{ pair: string; volume24h: number; apr: number }>;
  const total = pools.reduce((s, c) => s + c.tvlUsd, 0) || 1;
  return pools.map((c) => {
    const share = c.tvlUsd / total;
    const vol = volume24h * share;
    const fees = fees24h * share;
    const apr = c.tvlUsd > 0 ? (fees * 365 * 100) / c.tvlUsd : 0;
    const pair =
      c.role === "vault"
        ? c.label
        : c.label
            .replace(/\s*(Pool|LP)$/i, "")
            .replace(/-/g, " / ")
            .replace(/\s*\/\s*/g, " / ")
            .replace(/\s+/g, " ")
            .trim() || c.label;
    return { pair, volume24h: vol, apr };
  });
}

async function persistHistory(
  env: Env,
  slug: string,
  tvlUsd: number,
  feeBps: number,
  activity: Awaited<ReturnType<typeof sampleActivity>>,
) {
  const today = dayKey();
  const reconstructed = tvlFromNets(tvlUsd, activity.netBuckets);
  for (let i = 0; i < HIST_DAYS; i++) {
    const age = HIST_DAYS - 1 - i;
    const d = today - age;
    const vol = i === HIST_DAYS - 1 ? activity.volume24h : activity.volBuckets[i];
    const users = activity.userBuckets[i];
    const fees = feeBps > 0 ? vol * (feeBps / 10_000) : 0;
    const tvl = reconstructed[i];
    if (i === HIST_DAYS - 1 || vol > 0 || users > 0 || Math.abs(activity.netBuckets[i]) > 0) {
      await saveSnap(env, slug, d, tvl, vol, fees, users);
    }
  }
}

function mergeSeries(
  db: Array<{ date: string; value: number }>,
  live: number[],
  mode: "stock" | "flow",
  todayOverride?: number,
) {
  const today = dayKey();
  const byDay = new Map<number, number>();
  for (const p of db) {
    const d = dayKey(new Date(p.date + "T12:00:00Z").getTime());
    if (p.value > 0 || mode === "stock") byDay.set(d, p.value);
  }
  for (let i = 0; i < live.length; i++) {
    const d = today - (live.length - 1 - i);
    const v = live[i];
    if (mode === "flow") {
      if (v > 0) byDay.set(d, Math.max(byDay.get(d) ?? 0, v));
    } else if (v > 0) {
      byDay.set(d, v);
    }
  }
  if (todayOverride != null) byDay.set(today, todayOverride);
  return pointsFromMap(byDay, SERIES_DAYS, mode);
}

export async function ingestProtocol(env: Env, arc: Arcscan, p: ProtocolConfig) {
  const [tvlUsd, activity, age, contracts, txs] = await Promise.all([
    protocolTvl(arc, p),
    sampleActivity(arc, p),
    protocolAge(arc, p),
    contractTvls(arc, p),
    recentTxs(arc, p),
  ]);

  const feeBps = p.feeBps ?? (p.category === "dex" ? 30 : 0);
  const volume24h = activity.volume24h;
  const fees24h = feeBps > 0 ? volume24h * (feeBps / 10_000) : 0;

  // Don't clobber good cache with empty/rate-limited responses
  if (tvlUsd <= 0 && volume24h <= 0) {
    const prev = await getRanking(env, p.slug);
    if (prev && prev.tvlUsd > 0) {
      return { slug: p.slug, tvlUsd: prev.tvlUsd, volume24h: prev.volume24h, skipped: true };
    }
  }

  await persistHistory(env, p.slug, tvlUsd, feeBps, activity);

  const [change24h, change7d, change1m, changeVol] = await Promise.all([
    changePct(env, p.slug, "tvl", tvlUsd, 1),
    changePct(env, p.slug, "tvl", tvlUsd, 7),
    changePct(env, p.slug, "tvl", tvlUsd, 30),
    changePct(env, p.slug, "volume", volume24h, 1),
  ]);

  const sparkFromDb = await seriesFor(env, p.slug, "volume", 7);
  const spark7d = activity.spark7d.some((v) => v > 0)
    ? activity.spark7d
    : sparkFromDb.map((d) => d.value);

  const ranking: RankingRow = {
    slug: p.slug,
    name: p.name,
    category: p.category,
    tvlUsd,
    volume24h,
    fees24h: fees24h || undefined,
    age,
    txs: contracts.reduce((s, c) => s + c.txs, 0),
    transfers: contracts.reduce((s, c) => s + c.transfers, 0),
    contracts: p.contracts.map((c) => c.address),
    spark7d,
    change24h: change24h ?? pctFromNet(tvlUsd, activity.net24),
    change7d: change7d ?? pctFromNet(tvlUsd, activity.net7),
    change1m,
    mcapTvl: undefined,
    activeUsers24h: activity.activeUsers24h,
    updatedAt: Date.now(),
  };
  await saveRanking(env, ranking);

  const [dbTvl, dbVol, dbFees, dbUsers] = await Promise.all([
    seriesFor(env, p.slug, "tvl", SERIES_DAYS),
    seriesFor(env, p.slug, "volume", SERIES_DAYS),
    seriesFor(env, p.slug, "fees", SERIES_DAYS),
    seriesFor(env, p.slug, "users", SERIES_DAYS),
  ]);

  const reconstructed = tvlFromNets(tvlUsd, activity.netBuckets);
  const tvlLive = reconstructed.map((v, i) =>
    i === HIST_DAYS - 1 ||
    activity.volBuckets[i] > 0 ||
    Math.abs(activity.netBuckets[i]) > 0
      ? v
      : 0,
  );
  const tvlSeries = mergeSeries(dbTvl, tvlLive, "stock", tvlUsd);
  const volSeries = mergeSeries(dbVol, activity.volBuckets, "flow", volume24h);
  const feeSeries = volSeries.map((d) => ({
    date: d.date,
    value: feeBps > 0 ? d.value * (feeBps / 10_000) : 0,
  }));
  // overlay db fees when present
  for (let i = 0; i < feeSeries.length; i++) {
    const db = dbFees[i];
    if (db && db.value > feeSeries[i].value) feeSeries[i].value = db.value;
  }
  const userSeries = mergeSeries(dbUsers, activity.userBuckets, "flow", activity.activeUsers24h);

  const yVol = activity.volBuckets[HIST_DAYS - 2] ?? 0;
  const yUsers = activity.userBuckets[HIST_DAYS - 2] ?? 0;
  const changeFeesRaw =
    feeBps > 0 && yVol > 0
      ? ((fees24h - yVol * (feeBps / 10_000)) / (yVol * (feeBps / 10_000))) * 100
      : undefined;
  const changeUsersRaw =
    yUsers > 0 ? ((activity.activeUsers24h - yUsers) / yUsers) * 100 : undefined;
  const changeVolRaw =
    changeVol ?? (yVol > 0 ? ((volume24h - yVol) / yVol) * 100 : undefined);

  const sane = (pct?: number, prev = 0, cur = 0) => {
    if (pct == null || !Number.isFinite(pct)) return undefined;
    // Incomplete prior-day samples create fake huge % jumps
    if (prev > 0 && cur > 0 && prev < cur * 0.4) return undefined;
    if (Math.abs(pct) > 150) return undefined;
    return pct;
  };

  const breakdown = contracts
    .filter((c) => c.tvlUsd > 0)
    .map((c) => ({ label: c.label, value: c.tvlUsd }));
  if (!breakdown.length && tvlUsd > 0) breakdown.push({ label: p.name, value: tvlUsd });

  const detail: DetailPayload = {
    protocol: {
      slug: p.slug,
      name: p.name,
      category: p.category,
      description: p.description,
      website: p.website,
      docs: p.docs,
      twitter: p.twitter,
      discord: p.discord,
      feeBps: p.feeBps,
      contracts: p.contracts.map((c) => ({
        address: c.address,
        role: c.role,
        label: c.label,
      })),
    },
    rank: 0,
    tvlUsd,
    volume24h,
    fees24h,
    change24h: ranking.change24h,
    changeVol: sane(changeVolRaw, yVol, volume24h),
    changeFees: sane(changeFeesRaw, yVol, volume24h),
    changeUsers: sane(changeUsersRaw, yUsers, activity.activeUsers24h),
    activeUsers: activity.activeUsers24h,
    age,
    tvlSeries,
    volSeries,
    feeSpark: feeSeries.slice(-14).map((d) => d.value),
    tvlSpark: tvlSeries.slice(-14).map((d) => d.value),
    volSpark: volSeries.slice(-14).map((d) => d.value),
    userSpark: userSeries.slice(-14).map((d) => d.value),
    contracts,
    breakdown,
    pairs: buildPairs(contracts, volume24h, fees24h),
    activity: {
      txs: toPoints(activity.txBuckets, 30),
      transfers: toPoints(activity.transferBuckets, 30),
      unique: userSeries.slice(-30),
    },
    txs,
    totals: {
      txs: contracts.reduce((s, c) => s + c.txs, 0),
      transfers: contracts.reduce((s, c) => s + c.transfers, 0),
    },
    updatedAt: Date.now(),
  };

  await saveDetail(env, p.slug, detail);
  return { slug: p.slug, tvlUsd, volume24h };
}

export async function ingestAll(env: Env, arc: Arcscan) {
  const results = [];
  for (const p of protocols) {
    try {
      results.push(await ingestProtocol(env, arc, p));
    } catch (err) {
      results.push({ slug: p.slug, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 900));
  }

  let stableMcap = 0;
  for (const addr of [addresses.usdc, addresses.eurc, addresses.usyc]) {
    try {
      const t = await arc.token(addr);
      const raw = String(t.total_supply ?? "0");
      const decimals = Number(t.decimals ?? 6);
      const supply = Number(raw) / 10 ** decimals;
      if (Number.isFinite(supply)) stableMcap += supply;
    } catch {
      // skip
    }
  }

  await rebuildEco(env, stableMcap);
  await setMeta(env, "last_ingest", String(Date.now()));
  return { ok: true, count: results.length, results };
}

/** Fast pass: balances only (no transfer paging) — restores rankings after rate-limits. */
export async function ingestTvlFast(env: Env, arc: Arcscan) {
  const results = [];
  for (const p of protocols) {
    try {
      const [tvlUsd, contracts, age] = await Promise.all([
        protocolTvl(arc, p),
        contractTvls(arc, p),
        protocolAge(arc, p),
      ]);
      const prev = await getRanking(env, p.slug);
      if (tvlUsd <= 0 && prev && prev.tvlUsd > 0) {
        results.push({ slug: p.slug, tvlUsd: prev.tvlUsd, kept: true });
        continue;
      }
      const day = dayKey();
      await saveSnap(
        env,
        p.slug,
        day,
        tvlUsd,
        prev?.volume24h ?? 0,
        prev?.fees24h ?? 0,
        prev?.activeUsers24h ?? 0,
      );
      const ranking: RankingRow = {
        slug: p.slug,
        name: p.name,
        category: p.category,
        tvlUsd,
        volume24h: prev?.volume24h ?? 0,
        fees24h: prev?.fees24h,
        age: age ?? prev?.age,
        txs: contracts.reduce((s, c) => s + c.txs, 0),
        transfers: contracts.reduce((s, c) => s + c.transfers, 0),
        contracts: p.contracts.map((c) => c.address),
        spark7d: prev?.spark7d ?? [0, 0, 0, 0, 0, 0, 0],
        change24h: await changePct(env, p.slug, "tvl", tvlUsd, 1),
        change7d: await changePct(env, p.slug, "tvl", tvlUsd, 7),
        change1m: await changePct(env, p.slug, "tvl", tvlUsd, 30),
        mcapTvl: undefined,
        activeUsers24h: prev?.activeUsers24h ?? 0,
        updatedAt: Date.now(),
      };
      await saveRanking(env, ranking);

      const feeBps = p.feeBps ?? 0;
      const volume24h = ranking.volume24h;
      const fees24h = feeBps > 0 ? volume24h * (feeBps / 10_000) : ranking.fees24h ?? 0;
      const [tvlSeries, volSeries] = await Promise.all([
        seriesFor(env, p.slug, "tvl", SERIES_DAYS),
        seriesFor(env, p.slug, "volume", SERIES_DAYS),
      ]);
      if (tvlSeries.length) tvlSeries[tvlSeries.length - 1].value = tvlUsd;
      const breakdown = contracts
        .filter((c) => c.tvlUsd > 0)
        .map((c) => ({ label: c.label, value: c.tvlUsd }));
      const detail: DetailPayload = {
        protocol: {
          slug: p.slug,
          name: p.name,
          category: p.category,
          description: p.description,
          website: p.website,
          docs: p.docs,
          twitter: p.twitter,
          discord: p.discord,
          feeBps: p.feeBps,
          contracts: p.contracts.map((c) => ({
            address: c.address,
            role: c.role,
            label: c.label,
          })),
        },
        rank: 0,
        tvlUsd,
        volume24h,
        fees24h,
        change24h: ranking.change24h,
        activeUsers: ranking.activeUsers24h,
        age: ranking.age,
        tvlSeries,
        volSeries,
        feeSpark: volSeries.slice(-14).map((d) => (feeBps > 0 ? d.value * (feeBps / 10_000) : 0)),
        tvlSpark: tvlSeries.slice(-14).map((d) => d.value),
        volSpark: volSeries.slice(-14).map((d) => d.value),
        userSpark: [],
        contracts,
        breakdown: breakdown.length ? breakdown : tvlUsd > 0 ? [{ label: p.name, value: tvlUsd }] : [],
        pairs: buildPairs(contracts, volume24h, fees24h),
        activity: { txs: [], transfers: [], unique: [] },
        txs: [],
        totals: {
          txs: contracts.reduce((s, c) => s + c.txs, 0),
          transfers: contracts.reduce((s, c) => s + c.transfers, 0),
        },
        updatedAt: Date.now(),
      };
      const prevDetail = await getDetail(env, p.slug);
      if (prevDetail) {
        detail.volume24h = prevDetail.volume24h || volume24h;
        detail.fees24h = prevDetail.fees24h || fees24h;
        detail.activeUsers = prevDetail.activeUsers || detail.activeUsers;
        detail.volSeries = prevDetail.volSeries?.length ? prevDetail.volSeries : detail.volSeries;
        detail.activity = prevDetail.activity ?? detail.activity;
        detail.txs = prevDetail.txs?.length ? prevDetail.txs : detail.txs;
        detail.userSpark = prevDetail.userSpark ?? detail.userSpark;
        detail.volSpark = prevDetail.volSpark ?? detail.volSpark;
      }
      await saveDetail(env, p.slug, detail);
      results.push({ slug: p.slug, tvlUsd });
    } catch (err) {
      results.push({ slug: p.slug, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  await rebuildEco(env);
  await setMeta(env, "last_ingest", String(Date.now()));
  return { ok: true, mode: "tvl-fast", results };
}

export async function ingestOne(env: Env, arc: Arcscan, slug: string) {
  const p = protocols.find((x) => x.slug === slug);
  if (!p) return { error: "unknown slug", slug };
  const result = await ingestProtocol(env, arc, p);
  await rebuildEco(env);
  return result;
}

export { activeRankings };

function weightedChange(rows: RankingRow[]) {
  const total = rows.reduce((s, r) => s + r.tvlUsd, 0);
  if (total <= 0) return undefined;
  let acc = 0;
  let w = 0;
  for (const r of rows) {
    if (r.change24h == null || r.tvlUsd <= 0) continue;
    acc += r.change24h * r.tvlUsd;
    w += r.tvlUsd;
  }
  return w > 0 ? acc / w : undefined;
}
