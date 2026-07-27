import { addresses } from "@arclytics/chain";
import { arcscan } from "@/libs/arcscan";
import { getDashboardData, getProtocolRankings } from "@/libs/dashboard";
import { prefetch } from "@/libs/queryCache";
import { paths } from "@/routes/paths";

export async function loadDashboard() {
  const data = await getDashboardData();
  const tokens = await arcscan.tokens("ERC-20").catch(() => ({
    items: [] as Array<Record<string, unknown>>,
  }));
  const topTokens = (tokens.items ?? []).slice(0, 10).map((t) => ({
    address: String(t.address_hash),
    name: String(t.name ?? ""),
    symbol: String(t.symbol ?? ""),
    holdersCount: Number(t.holders_count ?? 0),
  }));
  return { data, topTokens };
}

export async function loadEcosystem() {
  const [rankings, statsRaw, txChart, addressChart] = await Promise.all([
    getProtocolRankings().catch(() => []),
    arcscan.stats().catch(() => ({}) as Record<string, unknown>),
    arcscan.txChart().catch(() => ({
      chart_data: [] as Array<{ date: string; transactions_count: number }>,
    })),
    arcscan.newAccountsChart().catch(() => [] as Array<{ date: string; value: number }>),
  ]);
  const spark = (txChart.chart_data ?? [])
    .slice()
    .reverse()
    .slice(-14)
    .map((d) => d.transactions_count);
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
  const latestAddr = addressChart.length ? addressChart[addressChart.length - 1].value : 0;
  const prevAddr =
    addressChart.length > 1 ? addressChart[addressChart.length - 2].value : latestAddr;
  const usersChange = prevAddr ? ((latestAddr - prevAddr) / prevAddr) * 100 : undefined;
  const txToday = Number(statsRaw.transactions_today ?? 0);
  const txTotal = Number(statsRaw.total_transactions ?? 0);
  const tvlUsd = rankings.reduce((s, r) => s + r.tvlUsd, 0);
  const volume24h = rankings.reduce((s, r) => s + (r.volume24h ?? 0), 0);
  const fees24h = rankings.reduce((s, r) => s + (r.fees24h ?? 0), 0);

  return {
    rows,
    spark,
    stats: {
      tvlUsd,
      tvlChange: undefined as number | undefined,
      protocolChange: undefined as number | undefined,
      volume24h,
      volumeChange: undefined as number | undefined,
      fees24h,
      feesChange: undefined as number | undefined,
      activeUsers: latestAddr || Number(statsRaw.total_addresses ?? 0),
      usersChange,
      transactions: txToday || txTotal,
      txChange: undefined as number | undefined,
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
  prefetchRoute(paths.ecosystem);
  prefetchRoute(paths.protocols);
  prefetchRoute(paths.tokens);
  prefetchRoute(paths.explorer);
}
