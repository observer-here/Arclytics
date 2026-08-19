import { getTokens } from "@/libs/api";
import { arcscan, type PageParams } from "@/libs/arcscan";
import { lpPriceFromReserves, spotPriceFromPool } from "@/libs/lpPrice";
import { fetchCache } from "@/libs/queryCache";
import { tokenMeta } from "@/config/tokens";
import { compact } from "@/utils/format";

export type Point = { date: string; value: number };

/** Served entirely from our own DB feed — no ArcScan round trip. */
export type TokenFeedInfo = {
  address: string;
  name: string;
  symbol: string;
  iconUrl?: string;
  category: string;
  protocol: string;
  amm: string;
  blurb?: string;
  price: number | null;
  marketCap: number | null;
  volume24h: number | null;
  change24h: number | null;
  change7d: number | null;
  rank: number | null;
  holdersCount: number;
  transfersCount: number;
  isSpot: boolean;
};

/** The only fields that require an ArcScan token lookup. */
export type TokenSupply = {
  address: string;
  name: string;
  symbol: string;
  iconUrl?: string;
  decimals: number;
  supply: number;
  circulating: number;
  exchangeRate: number | null;
  marketCap: number | null;
};

export type TokenMarket = {
  price: number | null;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  change24h: number | null;
  change7d: number | null;
  rank: number | null;
  tvlUsd: number | null;
  markets: Array<{
    pair: string;
    price: number | null;
    volume24h: number | null;
    change24h: number | null;
    liquidity: number | null;
  }>;
};

export type TokenCounts = { holdersCount: number; transfersCount: number };

/** Daily transfer volume in token units — price applied at render so it never waits on price. */
export type TokenVolumeBuckets = {
  daily: Array<{ date: string; tokens: number }>;
  rolling24hTokens: number;
};

/** Price-relative daily ratios from the pool's USDC balance history. */
export type TokenPriceRatios = Array<{ date: string; ratio: number }>;

export type TokenChartsData = {
  priceSeries: Point[];
  mcapSeries: Point[];
  volSeries: Point[];
};

export type TokenDetail = TokenFeedInfo &
  TokenMarket &
  TokenCounts &
  TokenChartsData & {
    decimals: number;
    supply: number;
    circulating: number;
    holderSlices: Array<{ label: string; value: number }>;
    holders: Array<Record<string, unknown>>;
    transfers: Array<Record<string, unknown>>;
  };

const DAY_MS = 86_400_000;

/* ---------- shared deduped endpoint reads ---------- */

const rawToken = (address: string) =>
  fetchCache(`ep:token:${address.toLowerCase()}`, () => arcscan.token(address).catch(() => null));

const rawFeed = () =>
  fetchCache("ep:token-feed", () =>
    getTokens().catch(() => ({ items: [] as Awaited<ReturnType<typeof getTokens>>["items"] })),
  );

/* ---------- helpers ---------- */

function liveBlurb(meta: ReturnType<typeof tokenMeta>, holders: number, transfers: number) {
  if (!meta?.pegUsd) return meta?.blurb;
  const parts: string[] = [];
  if (holders > 0) parts.push(`~${compact(holders)} holders`);
  if (transfers > 0) parts.push(`~${compact(transfers)} transfers`);
  return parts.length ? `Arc Testnet — ${parts.join(", ")}` : meta.blurb;
}

function transferAmount(item: Record<string, unknown>, fallbackDecimals: number) {
  const total = item.total as { value?: string; decimals?: string } | undefined;
  const token = item.token as { decimals?: string } | undefined;
  const dec = Number(total?.decimals ?? token?.decimals ?? fallbackDecimals);
  const amount = Number(total?.value ?? 0) / 10 ** dec;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

function dayLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDayKey(day: number) {
  return new Date(day * DAY_MS).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function mergeByDate(base: Point[], extra: Point[]) {
  const map = new Map(extra.map((p) => [p.date, p.value]));
  for (const p of base) if (p.value > 0) map.set(p.date, p.value);
  return [...map.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function buildPriceSeries(price: number, change24h: number, days = 30) {
  const daily = change24h / 100;
  const pts: Point[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const factor = 1 + daily * (i / Math.max(days - 1, 1));
    pts.push({ date: dayLabel(i), value: Math.max(0, price / factor) });
  }
  return pts;
}

export function holderDistribution(
  holders: Array<Record<string, unknown>>,
  supply: number,
  decimals: number,
) {
  if (!holders.length) return [];

  // Try scaled values first
  let top = 0;
  for (const h of holders.slice(0, 10)) top += Number(h.value ?? 0) / 10 ** decimals;

  // If supply > 0 and top makes sense, use percentage mode
  if (supply > 0 && top > 0 && top <= supply) {
    const topPct = Math.min(100, (top / supply) * 100);
    const rest = Math.max(0, 100 - topPct);
    const slices = [{ label: "Top 10 Holders", value: topPct }];
    if (rest > 0.1) slices.push({ label: "Other Holders", value: rest });
    return slices;
  }

  // Fallback: use raw counts (NFTs, tokens where decimals don't apply to holder values)
  let rawTop = 0;
  let rawTotal = 0;
  for (const h of holders.slice(0, 10)) rawTop += Number(h.value ?? 0);
  for (const h of holders) rawTotal += Number(h.value ?? 0);

  if (rawTotal <= 0) {
    // Equal share fallback — just show top 10 vs rest by count
    const topPct = Math.min(100, (Math.min(10, holders.length) / holders.length) * 100);
    const rest = Math.max(0, 100 - topPct);
    const slices = [{ label: "Top 10 Holders", value: topPct }];
    if (rest > 0.1) slices.push({ label: "Other Holders", value: rest });
    return slices;
  }

  const topPct = Math.min(100, (rawTop / rawTotal) * 100);
  const rest = Math.max(0, 100 - topPct);
  const slices = [{ label: "Top 10 Holders", value: topPct }];
  if (rest > 0.1) slices.push({ label: "Other Holders", value: rest });
  return slices;
}

/* ---------- independent loaders (each keyed on address only) ---------- */

/**
 * Everything our own DB already knows: identity, price, market cap, volume, change,
 * rank and counts. One backend request, no ArcScan — this is what fills the KPI cards.
 */
export async function loadTokenFeed(address: string): Promise<TokenFeedInfo | null> {
  const meta = tokenMeta(address);
  const feed = await rawFeed();
  const row = feed.items.find((t) => t.address.toLowerCase() === address.toLowerCase());
  if (!row) return null;

  const ranked = [...feed.items].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  const rankIdx = ranked.findIndex((t) => t.address.toLowerCase() === address.toLowerCase());

  return {
    address: row.address,
    name: row.name,
    symbol: row.symbol,
    iconUrl: row.iconUrl,
    category: meta?.category ?? row.category ?? "Other",
    protocol: meta?.protocol ?? row.protocol ?? "—",
    amm: meta?.amm ?? row.amm ?? "—",
    blurb: meta?.blurb ?? row.blurb,
    price: row.price ?? (meta?.pegUsd ? 1 : null),
    marketCap: row.marketCap,
    volume24h: row.volume24h,
    change24h: row.change24h ?? (meta?.pegUsd ? 0 : null),
    change7d: row.change7d ?? (meta?.pegUsd ? 0 : null),
    rank: rankIdx >= 0 ? rankIdx + 1 : null,
    holdersCount: Number(row.holders ?? 0),
    transfersCount: Number(row.transfers ?? 0),
    isSpot: Boolean(meta?.spotPool),
  };
}

/** Decimals and supply — the only fields that require ArcScan. */
export async function loadTokenSupply(address: string): Promise<TokenSupply | null> {
  const token = await rawToken(address);
  if (!token || (token as { message?: string }).message) return null;

  const decimals = Number(token.decimals ?? 18);
  const supply = Number(token.total_supply ?? 0) / 10 ** decimals;
  const circulating = Number(token.circulating_supply ?? token.total_supply ?? 0) / 10 ** decimals;
  const rate = token.exchange_rate != null ? Number(token.exchange_rate) : null;
  const mcap =
    token.circulating_market_cap != null && Number(token.circulating_market_cap) > 0
      ? Number(token.circulating_market_cap)
      : null;

  return {
    address: String(token.address_hash ?? address),
    name: String(token.name ?? ""),
    symbol: String(token.symbol ?? ""),
    iconUrl: token.icon_url ? String(token.icon_url) : undefined,
    decimals,
    supply: Number.isFinite(supply) ? supply : 0,
    circulating: Number.isFinite(circulating) ? circulating : 0,
    exchangeRate: rate != null && Number.isFinite(rate) && rate > 0 ? rate : null,
    marketCap: mcap,
  };
}

/** On-chain price fallback. Only does work when the feed has no price for this token. */
export async function loadTokenPriceFallback(
  address: string,
): Promise<{ price: number | null; tvlUsd: number | null }> {
  const meta = tokenMeta(address);
  if (!meta?.fromReserves && !meta?.spotPool) return { price: null, tvlUsd: null };

  const feed = await rawFeed();
  const row = feed.items.find((t) => t.address.toLowerCase() === address.toLowerCase());
  if (row?.price != null) return { price: null, tvlUsd: null };

  if (meta.fromReserves) {
    const lp = await lpPriceFromReserves(address);
    return { price: lp.price, tvlUsd: lp.tvlUsd || null };
  }
  const spot = await spotPriceFromPool(address, meta.spotPool!);
  return { price: spot.price, tvlUsd: spot.tvlUsd || null };
}

/** Refined holder / transfer counts straight from ArcScan. */
export async function loadTokenCounts(address: string): Promise<TokenCounts | null> {
  const counters = await arcscan.tokenCounters(address).catch(() => null);
  if (!counters) return null;
  return {
    holdersCount: Number(counters.token_holders_count ?? 0),
    transfersCount: Number(counters.transfers_count ?? 0),
  };
}

export function buildMarkets(
  address: string,
  symbol: string,
  price: number | null,
  volume24h: number | null,
  change24h: number | null,
  tvlUsd: number | null,
): TokenMarket["markets"] {
  const meta = tokenMeta(address);
  const markets: TokenMarket["markets"] = [];
  if (meta?.spotPool && price != null) {
    markets.push({ pair: `${symbol || "TOKEN"}/USDC`, price, volume24h, change24h, liquidity: tvlUsd });
  }
  if (meta?.fromReserves && tvlUsd != null) {
    markets.push({ pair: `${meta.protocol} LP`, price, volume24h, change24h, liquidity: tvlUsd });
  }
  return markets;
}

/** Top holders. Single request. */
export async function loadTokenHolderList(address: string) {
  const res = await arcscan
    .tokenHolders(address)
    .catch(() => ({ items: [] as Array<Record<string, unknown>> }));
  return res.items ?? [];
}

/** Recent transfers, first page only. Single request. */
export async function loadTokenTransferList(address: string) {
  const res = await arcscan
    .tokenTransfers(address)
    .catch(() => ({ items: [] as Array<Record<string, unknown>> }));
  return res.items ?? [];
}

/** Daily price ratios from the pool's USDC balance history. Price-independent. */
export async function loadTokenPriceRatios(address: string): Promise<TokenPriceRatios> {
  const meta = tokenMeta(address);
  const histAddr = meta?.spotPool ?? (meta?.fromReserves ? meta.address : null);
  if (!histAddr) return [];

  const hist = await arcscan.coinBalanceHistoryByDay(histAddr).catch(() => ({ items: [] }));
  const series = (hist.items ?? [])
    .map((item) => {
      const date = String(item.date ?? "");
      const usdc = Number(String(item.value ?? "0")) / 1e18;
      if (!date || !Number.isFinite(usdc) || usdc <= 0) return null;
      return { date, usdc };
    })
    .filter(Boolean) as Array<{ date: string; usdc: number }>;
  if (series.length < 2) return [];

  const last = series[series.length - 1]!.usdc;
  return series.map((h) => ({
    date: new Date(`${h.date}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    ratio: h.usdc / last,
  }));
}

/**
 * Daily + rolling-24h transfer volume in token units from one paging pass.
 * Replaces the two separate paging loops this used to run.
 */
export async function loadTokenVolumeBuckets(
  address: string,
  maxPages = 6,
): Promise<TokenVolumeBuckets> {
  const token = await rawToken(address);
  const decimals = Number(token?.decimals ?? 18);
  const cutoff = Date.now() - DAY_MS;
  const buckets = new Map<number, number>();
  let rolling24hTokens = 0;
  let params: PageParams = null;

  for (let page = 0; page < maxPages; page++) {
    const batch: Awaited<ReturnType<typeof arcscan.tokenTransfers>> | null = await arcscan
      .tokenTransfers(address, params)
      .catch(() => null);
    if (!batch?.items?.length) break;

    for (const item of batch.items) {
      const ts = item.timestamp ? new Date(String(item.timestamp)).getTime() : 0;
      if (!ts) continue;
      const amount = transferAmount(item, decimals);
      if (amount <= 0) continue;
      const day = Math.floor(ts / DAY_MS);
      buckets.set(day, (buckets.get(day) ?? 0) + amount);
      if (ts >= cutoff) rolling24hTokens += amount;
    }

    if (!batch.nextPageParams) break;
    params = batch.nextPageParams;
  }

  return {
    daily: [...buckets.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([day, tokens]) => ({ date: formatDayKey(day), tokens })),
    rolling24hTokens,
  };
}

/* ---------- pure composition (runs on every render with whatever has arrived) ---------- */

export function composeTokenCharts(input: {
  price: number | null;
  change24h: number | null;
  marketCap: number | null;
  supply: number;
  isSpot: boolean;
  ratios: TokenPriceRatios | null;
  buckets: TokenVolumeBuckets | null;
}): TokenChartsData {
  const { price, change24h, marketCap, supply, isSpot, ratios, buckets } = input;

  let priceSeries: Point[] = [];
  if (price != null && price > 0) {
    priceSeries =
      ratios && ratios.length >= 2
        ? ratios.map((r) => ({
            date: r.date,
            value: isSpot ? price * r.ratio * r.ratio : price * r.ratio,
          }))
        : buildPriceSeries(price, change24h ?? 0);
  }

  let mcapSeries: Point[] = [];
  if (supply > 0 && priceSeries.length) {
    mcapSeries = priceSeries.map((p) => ({ date: p.date, value: p.value * supply }));
  }
  if (marketCap != null && marketCap > 0) {
    mcapSeries = mergeByDate(mcapSeries, [{ date: dayLabel(0), value: marketCap }]);
  }

  let volSeries: Point[] = [];
  if (buckets?.daily.length && price != null && price > 0) {
    volSeries = buckets.daily.map((d) => ({ date: d.date, value: d.tokens * price }));
  }
  if (mcapSeries.length) {
    const volMap = new Map(volSeries.map((v) => [v.date, v.value]));
    volSeries = mcapSeries.map((m) => ({ date: m.date, value: volMap.get(m.date) ?? 0 }));
  }

  return { priceSeries, mcapSeries, volSeries };
}

export function resolveVolume24h(
  feedVolume: number | null,
  buckets: TokenVolumeBuckets | null,
  price: number | null,
) {
  if (feedVolume != null && feedVolume > 0) return feedVolume;
  if (!buckets || price == null || price <= 0) return null;
  const usd = buckets.rolling24hTokens * price;
  return Number.isFinite(usd) && usd > 0 ? usd : null;
}

/** Combined loader for contexts that need one object (e.g. token compare). */
export async function loadTokenDetail(address: string): Promise<TokenDetail | null> {
  const [feed, supplyInfo, fallback, counts, holders, transfers, ratios, buckets] =
    await Promise.all([
      loadTokenFeed(address),
      loadTokenSupply(address),
      loadTokenPriceFallback(address),
      loadTokenCounts(address),
      loadTokenHolderList(address),
      loadTokenTransferList(address),
      loadTokenPriceRatios(address),
      loadTokenVolumeBuckets(address),
    ]);
  if (!feed && !supplyInfo) return null;

  const meta = tokenMeta(address);
  const decimals = supplyInfo?.decimals ?? 18;
  const supply = supplyInfo?.supply ?? 0;
  const circulating = supplyInfo?.circulating ?? 0;
  const snapSupply = circulating > 0 ? circulating : supply;

  const price = feed?.price ?? fallback.price ?? supplyInfo?.exchangeRate ?? (meta?.pegUsd ? 1 : null);
  const change24h = feed?.change24h ?? null;
  let marketCap = feed?.marketCap ?? supplyInfo?.marketCap ?? null;
  if (marketCap == null && price != null && price > 0 && snapSupply > 0) marketCap = price * snapSupply;

  const holdersCount = counts?.holdersCount ?? feed?.holdersCount ?? 0;
  const transfersCount = counts?.transfersCount ?? feed?.transfersCount ?? 0;
  const volume24h = resolveVolume24h(feed?.volume24h ?? null, buckets, price);
  const symbol = feed?.symbol ?? supplyInfo?.symbol ?? "";

  const charts = composeTokenCharts({
    price,
    change24h,
    marketCap,
    supply: snapSupply,
    isSpot: Boolean(meta?.spotPool),
    ratios,
    buckets,
  });

  return {
    address: feed?.address ?? supplyInfo?.address ?? address,
    name: feed?.name ?? supplyInfo?.name ?? "",
    symbol,
    iconUrl: feed?.iconUrl ?? supplyInfo?.iconUrl,
    category: feed?.category ?? meta?.category ?? "Other",
    protocol: feed?.protocol ?? meta?.protocol ?? "—",
    amm: feed?.amm ?? meta?.amm ?? "—",
    blurb: liveBlurb(meta, holdersCount, transfersCount) ?? feed?.blurb,
    price,
    marketCap,
    fdv: price != null && supply > 0 ? price * supply : null,
    volume24h,
    change24h,
    change7d: feed?.change7d ?? null,
    rank: feed?.rank ?? null,
    tvlUsd: fallback.tvlUsd,
    isSpot: Boolean(meta?.spotPool),
    markets: buildMarkets(address, symbol, price, volume24h, change24h, fallback.tvlUsd),
    decimals,
    supply,
    circulating,
    holdersCount,
    transfersCount,
    ...charts,
    holderSlices: holderDistribution(holders, supply, decimals),
    holders,
    transfers,
  };
}
