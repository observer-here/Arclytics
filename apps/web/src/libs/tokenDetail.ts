import { curatedTokenMeta } from "@arclytics/chain";
import { getTokenHistory, getTokens } from "@/libs/api";
import { arcscan, type PageParams } from "@/libs/arcscan";
import { lpPriceFromReserves, spotPriceFromPool } from "@/libs/lpPrice";
import { tokenMeta } from "@/config/tokens";
import { compact } from "@/utils/format";

export type TokenDetail = {
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
  fdv: number | null;
  volume24h: number | null;
  change24h: number | null;
  change7d: number | null;
  supply: number;
  circulating: number;
  holdersCount: number;
  transfersCount: number;
  rank: number | null;
  decimals: number;
  tvlUsd: number | null;
  spotPool?: string;
  priceSeries: Array<{ date: string; value: number }>;
  mcapSeries: Array<{ date: string; value: number }>;
  volSeries: Array<{ date: string; value: number }>;
  holderSlices: Array<{ label: string; value: number }>;
  markets: Array<{
    pair: string;
    price: number | null;
    volume24h: number | null;
    change24h: number | null;
    liquidity: number | null;
  }>;
  holders: Array<Record<string, unknown>>;
  transfers: Array<Record<string, unknown>>;
};

type Point = { date: string; value: number };

const DAY_MS = 86_400_000;

function liveBlurb(
  meta: ReturnType<typeof tokenMeta>,
  holders: number,
  transfers: number,
) {
  if (!meta?.pegUsd) return meta?.blurb;
  const parts: string[] = [];
  if (holders > 0) parts.push(`~${compact(holders)} holders`);
  if (transfers > 0) parts.push(`~${compact(transfers)} transfers`);
  return parts.length ? `Arc Testnet — ${parts.join(", ")}` : meta.blurb;
}

async function volume24hFromTransfers(address: string, decimals: number, price: number) {
  if (!(price > 0)) return null;
  const cutoff = Date.now() - DAY_MS;
  let params: PageParams = null;
  let sum = 0;

  for (let page = 0; page < 8; page++) {
    const batch: Awaited<ReturnType<typeof arcscan.tokenTransfers>> | null =
      await arcscan.tokenTransfers(address, params).catch(() => null);
    if (!batch?.items?.length) break;
    let covered = false;
    for (const item of batch.items) {
      const ts = item.timestamp ? new Date(String(item.timestamp)).getTime() : 0;
      if (!ts || ts < cutoff) {
        covered = true;
        break;
      }
      sum += transferAmount(item, decimals);
    }
    if (covered || !batch.nextPageParams) break;
    params = batch.nextPageParams;
  }

  const usdVol = sum * price;
  return Number.isFinite(usdVol) && usdVol > 0 ? usdVol : null;
}

function dayKeyFromTs(ts: number) {
  return Math.floor(ts / DAY_MS);
}

function formatDayKey(day: number) {
  return new Date(day * DAY_MS).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function transferAmount(item: Record<string, unknown>, fallbackDecimals: number) {
  const total = item.total as { value?: string; decimals?: string } | undefined;
  const token = item.token as { decimals?: string } | undefined;
  const dec = Number(total?.decimals ?? token?.decimals ?? fallbackDecimals);
  const amount = Number(total?.value ?? 0) / 10 ** dec;
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

/** Build daily USD volume by paging ArcScan transfers (all indexed history, capped). */
async function volumeHistoryFromTransfers(
  address: string,
  decimals: number,
  price: number | null,
  maxPages = 50,
) {
  if (!price || price <= 0) return [] as Point[];
  const buckets = new Map<number, number>();
  let params: PageParams = null;

  for (let page = 0; page < maxPages; page++) {
    const batch: Awaited<ReturnType<typeof arcscan.tokenTransfers>> | null =
      await arcscan.tokenTransfers(address, params).catch(() => null);
    if (!batch?.items?.length) break;

    for (const item of batch.items) {
      const ts = item.timestamp ? new Date(String(item.timestamp)).getTime() : 0;
      if (!ts) continue;
      const amount = transferAmount(item, decimals);
      if (amount <= 0) continue;
      const day = dayKeyFromTs(ts);
      buckets.set(day, (buckets.get(day) ?? 0) + amount);
    }

    if (!batch.nextPageParams) break;
    params = batch.nextPageParams;
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, tokenVol]) => ({
      date: formatDayKey(day),
      value: tokenVol * price,
    }));
}

function flatMcapSeries(dates: Point[], marketCap: number | null) {
  if (!marketCap || marketCap <= 0 || !dates.length) return [] as Point[];
  return dates.map((d) => ({ date: d.date, value: marketCap }));
}

function dayLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function mergeByDate(base: Point[], extra: Point[]) {
  const map = new Map(extra.map((p) => [p.date, p.value]));
  for (const p of base) {
    if (p.value > 0) map.set(p.date, p.value);
  }
  return [...map.entries()]
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

function alignVolume(mcap: Point[], volume: Point[], fallback: number | null) {
  const volMap = new Map(volume.map((v) => [v.date, v.value]));
  return mcap.map((m) => ({
    date: m.date,
    value: volMap.get(m.date) ?? (fallback ?? 0),
  }));
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

async function arcscanPriceSeries(
  meta: ReturnType<typeof tokenMeta>,
  histAddr: string,
  price: number,
  supply: number,
) {
  const hist = await arcscan.coinBalanceHistoryByDay(histAddr).catch(() => ({ items: [] }));
  const series = (hist.items ?? [])
    .map((item) => {
      const date = String(item.date ?? "");
      if (!date) return null;
      const usdc = Number(String(item.value ?? "0")) / 1e18;
      if (!Number.isFinite(usdc) || usdc <= 0) return null;
      return { date, usdc };
    })
    .filter(Boolean) as Array<{ date: string; usdc: number }>;
  if (series.length < 2) return { price: [] as Point[], mcap: [] as Point[] };

  const last = series[series.length - 1]!.usdc;
  const isSpot = Boolean(meta?.spotPool);
  const pricePts: Point[] = [];
  const mcapPts: Point[] = [];
  for (const h of series) {
    const ratio = h.usdc / last;
    const v = isSpot ? price * ratio * ratio : price * ratio;
    const label = new Date(`${h.date}T12:00:00Z`).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    pricePts.push({ date: label, value: v });
    if (supply > 0) mcapPts.push({ date: label, value: v * supply });
  }
  return { price: pricePts, mcap: mcapPts };
}

function holderDistribution(
  holders: Array<Record<string, unknown>>,
  supply: number,
  decimals: number,
) {
  if (supply <= 0 || !holders.length) return [];
  let top = 0;
  for (const h of holders.slice(0, 10)) {
    top += Number(h.value ?? 0) / 10 ** decimals;
  }
  const topPct = Math.min(100, (top / supply) * 100);
  const rest = Math.max(0, 100 - topPct);
  const slices = [{ label: "Top 10 Holders", value: topPct }];
  if (rest > 0.1) slices.push({ label: "Other Holders", value: rest });
  return slices;
}

export async function loadTokenDetail(address: string): Promise<TokenDetail | null> {
  const meta = tokenMeta(address) ?? curatedTokenMeta(address);
  const feed = await getTokens().catch(() => ({ items: [] as Awaited<ReturnType<typeof getTokens>>["items"] }));
  const feedRow = feed.items.find((t) => t.address.toLowerCase() === address.toLowerCase());
  const ranked = [...feed.items].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  const rankIdx = ranked.findIndex((t) => t.address.toLowerCase() === address.toLowerCase());

  const [token, counters, holders, transfers, history] = await Promise.all([
    arcscan.token(address).catch(() => null),
    arcscan.tokenCounters(address).catch(() => null),
    arcscan.tokenHolders(address).catch(() => ({ items: [] as Array<Record<string, unknown>> })),
    arcscan.tokenTransfers(address).catch(() => ({ items: [] as Array<Record<string, unknown>> })),
    getTokenHistory(address),
  ]);
  if (!token || (token as { message?: string }).message) return null;

  const rate = token.exchange_rate != null ? Number(token.exchange_rate) : null;
  let price: number | null =
    feedRow?.price ?? (rate != null && Number.isFinite(rate) && rate > 0 ? rate : null);
  let tvlUsd: number | null = null;
  let marketCap: number | null =
    feedRow?.marketCap ??
    (token.circulating_market_cap != null && Number(token.circulating_market_cap) > 0
      ? Number(token.circulating_market_cap)
      : null);

  if (price == null && meta?.fromReserves) {
    const lp = await lpPriceFromReserves(address);
    price = lp.price;
    tvlUsd = lp.tvlUsd || null;
    if (price != null && lp.supply > 0) marketCap = price * lp.supply;
  }
  if (price == null && meta?.spotPool) {
    const spot = await spotPriceFromPool(address, meta.spotPool);
    price = spot.price;
    tvlUsd = spot.tvlUsd || null;
    const dec = Number(token.decimals ?? 18);
    const supply = Number(token.total_supply ?? 0) / 10 ** dec;
    if (price != null && supply > 0) marketCap = price * supply;
  }
  if (price == null && meta?.pegUsd) price = 1;

  const decimals = Number(token.decimals ?? 18);
  const supply = Number(token.total_supply ?? 0) / 10 ** decimals;
  const circulating = Number(token.circulating_supply ?? token.total_supply ?? 0) / 10 ** decimals;

  if (marketCap == null && price != null && price > 0 && supply > 0) {
    marketCap = price * (circulating > 0 ? circulating : supply);
  }

  const change24h = feedRow?.change24h ?? (meta?.pegUsd ? 0 : null);
  const change7d = feedRow?.change7d ?? (meta?.pegUsd ? 0 : null);
  let volume24h = feedRow?.volume24h ?? null;
  if ((volume24h == null || volume24h <= 0) && price != null && price > 0) {
    volume24h = await volume24hFromTransfers(address, decimals, price);
  }
  const holdersCount = Number(counters?.token_holders_count ?? token.holders_count ?? 0);
  const transfersCount = Number(counters?.transfers_count ?? 0);
  const fdv = price != null && supply > 0 ? price * supply : null;
  const snapSupply = circulating > 0 ? circulating : supply;

  let priceSeries = price != null ? buildPriceSeries(price, change24h ?? 0) : [];
  let mcapSeries = [...history.mcap];
  let volSeries = [...history.volume];

  const histAddr = meta?.spotPool ?? (meta?.fromReserves ? meta.address : null);
  if (histAddr && price != null && price > 0) {
    const arc = await arcscanPriceSeries(meta, histAddr, price, snapSupply);
    if (arc.price.length >= 2) priceSeries = arc.price;
    if (arc.mcap.length >= 2) mcapSeries = mergeByDate(mcapSeries, arc.mcap);
  }

  if (mcapSeries.length < 2 && price != null && price > 0 && snapSupply > 0) {
    mcapSeries = mergeByDate(
      mcapSeries,
      buildPriceSeries(price, change24h ?? 0).map((p) => ({
        date: p.date,
        value: p.value * snapSupply,
      })),
    );
  }

  if (marketCap != null && marketCap > 0) {
    const today = dayLabel(0);
    mcapSeries = mergeByDate(mcapSeries, [{ date: today, value: marketCap }]);
  }

  if (volSeries.length < 2 && price != null && price > 0) {
    const fromTx = await volumeHistoryFromTransfers(address, decimals, price);
    if (fromTx.length) volSeries = mergeByDate(volSeries, fromTx);
  }

  if (volSeries.length >= 2 && mcapSeries.length < 2 && marketCap != null && marketCap > 0) {
    mcapSeries = flatMcapSeries(volSeries, marketCap);
  } else if (volSeries.length > mcapSeries.length && marketCap != null && marketCap > 0) {
    const mcapMap = new Map(mcapSeries.map((p) => [p.date, p.value]));
    mcapSeries = volSeries.map((v) => ({
      date: v.date,
      value: mcapMap.get(v.date) ?? marketCap,
    }));
  }

  if (volSeries.length < 2 && volume24h != null && volume24h > 0 && mcapSeries.length >= 2) {
    volSeries = mcapSeries.map((p) => ({ date: p.date, value: volume24h }));
  } else if (mcapSeries.length > 0) {
    volSeries = alignVolume(mcapSeries, volSeries, volume24h);
  }

  const markets: TokenDetail["markets"] = [];
  if (meta?.spotPool && price != null) {
    markets.push({
      pair: `${String(token.symbol ?? "TOKEN")}/USDC`,
      price,
      volume24h,
      change24h,
      liquidity: tvlUsd,
    });
  }
  if (meta?.fromReserves && tvlUsd != null) {
    markets.push({
      pair: `${meta.protocol} LP`,
      price,
      volume24h,
      change24h,
      liquidity: tvlUsd,
    });
  }

  return {
    address: String(token.address_hash ?? address),
    name: String(token.name ?? feedRow?.name ?? ""),
    symbol: String(token.symbol ?? feedRow?.symbol ?? ""),
    iconUrl: feedRow?.iconUrl ?? (token.icon_url ? String(token.icon_url) : undefined),
    category: meta?.category ?? feedRow?.category ?? "Other",
    protocol: meta?.protocol ?? feedRow?.protocol ?? "—",
    amm: meta?.amm ?? feedRow?.amm ?? "—",
    blurb: liveBlurb(meta, holdersCount, transfersCount) ?? feedRow?.blurb,
    price,
    marketCap,
    fdv,
    volume24h,
    change24h,
    change7d,
    supply: Number.isFinite(supply) ? supply : 0,
    circulating: Number.isFinite(circulating) ? circulating : 0,
    holdersCount,
    transfersCount,
    rank: rankIdx >= 0 ? rankIdx + 1 : null,
    decimals,
    tvlUsd,
    spotPool: meta?.spotPool,
    priceSeries,
    mcapSeries,
    volSeries,
    holderSlices: holderDistribution(holders.items ?? [], supply, decimals),
    markets,
    holders: holders.items ?? [],
    transfers: transfers.items ?? [],
  };
}
