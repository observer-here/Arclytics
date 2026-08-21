import { getTokens, loadEcosystemFeed } from "@/libs/api";
import { arcscan } from "@/libs/arcscan";
import {
  loadDashAddrChart,
  loadDashKpis,
  loadDashRankings,
  loadDashTokens,
  loadDashTxChart,
  loadDashValidators,
  loadDashVolChart,
} from "@/libs/dashboard";
import { fetchCache, prefetch } from "@/libs/queryCache";
import { paths } from "@/routes/paths";

export const DASH = {
  kpis: "dash-kpis-v2",
  rankings: "protocol-rankings-v11",
  tokens: "dash-tokens-v1",
  validators: "dash-validators-v1",
  tx: "dash-tx-v1",
  addr: "dash-addr-v1",
  vol: "dash-vol-v1",
} as const;

export const ANALYTICS = {
  contracts: "analytics-contracts-v1",
  tokens: "analytics-tokens-v1",
  wallets: "analytics-wallets-v1",
} as const;

export function prefetchDashboard() {
  prefetch(DASH.kpis, loadDashKpis);
  prefetch(DASH.rankings, loadDashRankings);
  prefetch(DASH.tokens, loadDashTokens);
  prefetch(DASH.validators, loadDashValidators);
  prefetch(DASH.tx, loadDashTxChart);
  prefetch(DASH.addr, loadDashAddrChart);
  prefetch(DASH.vol, loadDashVolChart);
}

export async function prefetchAnalytics() {
  const { loadAnalyticsContracts, loadAnalyticsTokens, loadAnalyticsWallets } =
    await import("@/libs/analytics");
  prefetchDashboard();
  prefetch(ANALYTICS.contracts, loadAnalyticsContracts);
  prefetch(ANALYTICS.tokens, loadAnalyticsTokens);
  prefetch(ANALYTICS.wallets, loadAnalyticsWallets);
}

export async function loadNetworkMeta() {
  const [kpis, blocks] = await Promise.all([
    fetchCache(DASH.kpis, loadDashKpis).catch(() => null),
    arcscan.mainPageBlocks().catch(() => [] as Array<Record<string, unknown>>),
  ]);
  const latestBlock = (blocks[0]?.height ?? blocks[0]?.number ?? null) as
    | string
    | number
    | null;
  const avgBlockTime = kpis?.averageBlockTime || undefined;
  const txToday = kpis?.transactionsToday ?? 0;
  const tps = txToday > 0 ? txToday / 86_400 : undefined;
  return { latestBlock, avgBlockTime, tps };
}

const routeLoaders: Record<string, () => Promise<unknown>> = {
  [paths.ecosystem]: loadEcosystemFeed,
  [paths.protocols]: loadDashRankings,
  [paths.rankings]: loadDashRankings,
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
  [paths.compare]: async () => {
    const { loadDashRankings } = await import("@/libs/dashboard");
    return loadDashRankings();
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
};

const cacheKeyByPath: Record<string, string> = {
  [paths.ecosystem]: "ecosystem-v11",
  [paths.protocols]: DASH.rankings,
  [paths.rankings]: DASH.rankings,
  [paths.tokens]: "tokens-api-v3",
  [paths.tokensMarketCap]: "tokens-api-v3",
  [paths.nfts]: "nfts-dashboard-v1",
  [paths.compare]: DASH.rankings,
  [paths.explorer]: "transactions",
  [paths.blocks]: "blocks",
  [paths.transactions]: "transactions",
  [paths.walletTracker]: "wallet-tracker-v6",
};

export function prefetchRoute(path: string) {
  if (path === paths.home) {
    prefetchDashboard();
    return;
  }
  if (path === paths.analytics) {
    void prefetchAnalytics();
    return;
  }
  const loader = routeLoaders[path];
  const key = cacheKeyByPath[path];
  if (!loader || !key) return;
  void prefetch(key, loader);
}

export function prefetchCore() {
  prefetchDashboard();
  void prefetch("networkMeta", loadNetworkMeta);
}
