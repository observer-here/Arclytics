import { addresses } from "@arclytics/chain";
import { arcscan } from "@/libs/arcscan";
import { getDashboardData, getProtocolRankings } from "@/libs/dashboard";
import { ecoChangePct, recordEcoSnapshot } from "@/libs/ecoSnapshots";
import { prefetch } from "@/libs/queryCache";
import { dayOverDayPct, lastCompleteValue, weightedChange } from "@/libs/seriesChange";
import { paths } from "@/routes/paths";

export async function loadDashboard() {
  const [data, tokens] = await Promise.all([
    getDashboardData(),
    arcscan.tokens("ERC-20").catch(() => ({
      items: [] as Array<Record<string, unknown>>,
    })),
  ]);
  const topTokens = (tokens.items ?? []).slice(0, 10).map((t) => ({
    address: String(t.address_hash),
    name: String(t.name ?? ""),
    symbol: String(t.symbol ?? ""),
    holdersCount: Number(t.holders_count ?? 0),
    iconUrl: t.icon_url ? String(t.icon_url) : undefined,
  }));
  return { data, topTokens };
}

export async function loadEcosystem() {
  const [rankings, statsRaw, addressChart, usdcVol, txnsFee, counters, ...stableTokens] =
    await Promise.all([
      getProtocolRankings().catch(() => []),
      arcscan.stats().catch(() => ({}) as Record<string, unknown>),
      arcscan.newAccountsChart().catch(() => [] as Array<{ date: string; value: number; approx?: boolean }>),
      arcscan.usdcVolumeChart().catch(() => [] as Array<{ date: string; value: number; approx?: boolean }>),
      arcscan.statsLine("txnsFee").catch(() => [] as Array<{ date: string; value: number; approx?: boolean }>),
      arcscan.statsCounters().catch(() => ({}) as Record<string, number>),
      arcscan.token(addresses.usdc).catch(() => null),
      arcscan.token(addresses.eurc).catch(() => null),
      arcscan.token(addresses.usyc).catch(() => null),
    ]);

  const stableMcap = [addresses.usdc, addresses.eurc, addresses.usyc].reduce((s, _addr, i) => {
    const t = stableTokens[i];
    const raw = String(t?.total_supply ?? "0");
    const decimals = Number(t?.decimals ?? 6);
    const supply = Number(raw) / 10 ** decimals;
    return s + (Number.isFinite(supply) ? supply : 0);
  }, 0);

  const spark = usdcVol.slice(-14).map((d) => d.value);
  const rows = rankings.map((r) => ({
    slug: r.slug,
    name: r.name,
    category: r.category,
    tvlUsd: r.tvlUsd,
    change24h: r.change24h,
    change7d: r.change7d,
    change1m: r.change1m,
    volume24h: r.volume24h,
    fees24h: r.fees24h,
    age: r.age,
  }));

  const latestAddr = lastCompleteValue(addressChart) ?? 0;
  const volume24h = rankings.reduce((s, r) => s + (r.volume24h ?? 0), 0);
  const networkFees = lastCompleteValue(txnsFee) ?? counters.txnsFee24h ?? 0;
  const fees24h = networkFees || rankings.reduce((s, r) => s + (r.fees24h ?? 0), 0);
  const tvlUsd = rankings.reduce((s, r) => s + r.tvlUsd, 0);

  recordEcoSnapshot({ volume24h, fees24h, protocols: rows.length, stableMcap });

  return {
    rows,
    spark,
    stats: {
      tvlUsd,
      tvlChange: weightedChange(rankings),
      protocolChange: ecoChangePct("protocols", rows.length),
      volume24h,
      volumeChange: ecoChangePct("volume24h", volume24h) ?? dayOverDayPct(usdcVol),
      fees24h,
      feesChange: ecoChangePct("fees24h", fees24h) ?? dayOverDayPct(txnsFee),
      activeUsers: latestAddr,
      usersChange: dayOverDayPct(addressChart),
      transactions: Number(counters.newTxns24h ?? statsRaw.transactions_today ?? 0),
      txChange: undefined as number | undefined,
      stableMcap,
      stableChange: ecoChangePct("stableMcap", stableMcap),
    },
  };
}

const routeLoaders: Record<string, () => Promise<unknown>> = {
  [paths.home]: loadDashboard,
  [paths.ecosystem]: loadEcosystem,
  [paths.protocols]: () => getProtocolRankings().catch(() => []),
  [paths.rankings]: () => getProtocolRankings().catch(() => []),
  [paths.tokens]: async () => {
    const data = await arcscan.tokens("ERC-20").catch(() => ({ items: [] }));
    return (data.items ?? []).map((t) => ({
      address: String(t.address_hash),
      name: String(t.name ?? ""),
      symbol: String(t.symbol ?? ""),
      holdersCount: Number(t.holders_count ?? 0),
      iconUrl: t.icon_url ? String(t.icon_url) : undefined,
    }));
  },
  [paths.nfts]: async () => {
    const data = await arcscan.tokens("ERC-721").catch(() => ({ items: [] }));
    return data.items ?? [];
  },
  [paths.stablecoins]: async () =>
    Promise.all(
      [
        { address: addresses.usdc, symbol: "USDC" },
        { address: addresses.eurc, symbol: "EURC" },
        { address: addresses.usyc, symbol: "USYC" },
      ].map(async (s) => {
        const t = await arcscan.token(s.address).catch(() => null);
        return {
          ...s,
          name: String(t?.name ?? s.symbol),
          holders: Number(t?.holders_count ?? 0),
          iconUrl: t?.icon_url ? String(t.icon_url) : undefined,
        };
      }),
    ),
  [paths.analytics]: async () => {
    const chart = await arcscan.txChart().catch(() => ({ chart_data: [] }));
    return (chart.chart_data ?? [])
      .slice()
      .reverse()
      .map((d) => ({ date: d.date, value: d.transactions_count }));
  },
  [paths.explorer]: () =>
    arcscan.transactionsPage(null).then((d) => d.items).catch(() => []),
  [paths.blocks]: () =>
    arcscan.blocksPage(null).then((d) => d.items).catch(() => []),
  [paths.transactions]: () =>
    arcscan.transactionsPage(null).then((d) => d.items).catch(() => []),
  networkMeta: async () => {
    const [blocks, stats] = await Promise.all([
      arcscan.mainPageBlocks().catch(() => [] as Array<Record<string, unknown>>),
      arcscan.stats().catch(() => ({}) as Record<string, unknown>),
    ]);
    const latestBlock = (blocks[0]?.height ?? blocks[0]?.number ?? null) as
      | string
      | number
      | null;
    const avgBlockTime = Number(stats.average_block_time ?? 0) || undefined;
    const txToday = Number(stats.transactions_today ?? 0);
    const tps = txToday > 0 ? txToday / 86_400 : undefined;
    return { latestBlock, avgBlockTime, tps };
  },
};

const cacheKeyByPath: Record<string, string> = {
  [paths.home]: "dashboard",
  [paths.ecosystem]: "ecosystem",
  [paths.protocols]: "protocol-rankings",
  [paths.rankings]: "protocol-rankings",
  [paths.tokens]: "tokens-erc20",
  [paths.nfts]: "tokens-erc721",
  [paths.stablecoins]: "stablecoins",
  [paths.analytics]: "analytics-tx",
  [paths.explorer]: "transactions",
  [paths.blocks]: "blocks",
  [paths.transactions]: "transactions",
};

export function prefetchRoute(path: string) {
  const loader = routeLoaders[path];
  const key = cacheKeyByPath[path];
  if (!loader || !key) return;
  prefetch(key, loader);
}

export function prefetchCore() {
  prefetch("networkMeta", routeLoaders.networkMeta);
  prefetchRoute(paths.home);
}
