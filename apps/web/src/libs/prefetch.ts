import { getProtocolRankings, getTokens, loadEcosystemFeed } from "@/libs/api";
import { arcscan } from "@/libs/arcscan";
import { getDashboardData } from "@/libs/dashboard";
import { prefetch } from "@/libs/queryCache";
import { paths } from "@/routes/paths";

export async function loadDashboard() {
  const [data, feed] = await Promise.all([
    getDashboardData(),
    getTokens().catch(() => ({ items: [] as Array<{ address: string; name: string; symbol: string; holders: number; iconUrl?: string }> })),
  ]);
  const topTokens = [...(feed.items ?? [])]
    .sort((a, b) => b.holders - a.holders)
    .slice(0, 10)
    .map((t) => ({
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      holdersCount: t.holders,
      iconUrl: t.iconUrl,
    }));
  return { data, topTokens };
}

export async function loadEcosystem() {
  return loadEcosystemFeed();
}

const routeLoaders: Record<string, () => Promise<unknown>> = {
  [paths.home]: loadDashboard,
  [paths.ecosystem]: loadEcosystem,
  [paths.protocols]: () => getProtocolRankings().catch(() => []),
  [paths.rankings]: () => getProtocolRankings().catch(() => []),
  [paths.tokens]: async () => {
    const feed = await getTokens();
    return feed.items ?? [];
  },
  [paths.tokensMarketCap]: async () => {
    const feed = await getTokens();
    return feed.items ?? [];
  },
  [paths.nfts]: async () => {
    const { loadNftDashboard } = await import("@/libs/nfts");
    return loadNftDashboard();
  },
  [paths.analytics]: async () => {
    const { loadAnalytics } = await import("@/libs/analytics");
    return loadAnalytics();
  },
  [paths.compare]: async () => {
    const { loadCompareProtocols } = await import("@/libs/compare");
    return loadCompareProtocols();
  },
  [paths.explorer]: () =>
    arcscan.transactionsPage(null).then((d) => d.items).catch(() => []),
  [paths.blocks]: () =>
    arcscan.blocksPage(null).then((d) => d.items).catch(() => []),
  [paths.transactions]: () =>
    arcscan.transactionsPage(null).then((d) => d.items).catch(() => []),
  [paths.walletTracker]: async () => {
    const { loadWalletDashboard } = await import("@/libs/wallets");
    return loadWalletDashboard();
  },
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
  [paths.home]: "dashboard-v3",
  [paths.ecosystem]: "ecosystem-v11",
  [paths.protocols]: "protocol-rankings-v11",
  [paths.rankings]: "protocol-rankings-v11",
  [paths.tokens]: "tokens-api-v3",
  [paths.tokensMarketCap]: "tokens-api-v3",
  [paths.nfts]: "nfts-dashboard-v1",
  [paths.analytics]: "analytics-v7",
  [paths.compare]: "compare-v2",
  [paths.explorer]: "transactions",
  [paths.blocks]: "blocks",
  [paths.transactions]: "transactions",
  [paths.walletTracker]: "wallet-tracker-v6",
};

export function prefetchRoute(path: string) {
  const loader = routeLoaders[path];
  const key = cacheKeyByPath[path];
  if (!loader || !key) return;
  void prefetch(key, loader);
}

export function prefetchNetworkMeta() {
  void prefetch("networkMeta", routeLoaders.networkMeta);
}

/** Warm critical routes on app boot */
export function prefetchCore() {
  prefetchRoute(paths.home);
  prefetchRoute(paths.ecosystem);
  prefetchRoute(paths.tokens);
  prefetchNetworkMeta();
}
