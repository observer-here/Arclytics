import { addresses, tokenLogo } from "@arclytics/chain";
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
    const data = await arcscan.tokens("ERC-721").catch(() => ({ items: [] }));
    return data.items ?? [];
  },
  [paths.stablecoins]: async () =>
    Promise.all(
      [
        { address: addresses.usdc, symbol: "USDC" },
        { address: addresses.eurc, symbol: "EURC" },
        { address: "0x175cdb1d338945f0d851a741ccf787d343e57952", symbol: "USDT" },
        { address: "0x825ae482558415310c71b7e03d2bbbe409345903", symbol: "USYC" },
        { address: "0x911b4000D3422F482F4062a913885f7b035382Df", symbol: "WUSDC" },
      ].map(async (s) => {
        const [t, c] = await Promise.all([
          arcscan.token(s.address).catch(() => null),
          arcscan.tokenCounters(s.address).catch(() => null),
        ]);
        return {
          ...s,
          name: String(t?.name ?? s.symbol),
          holders: Number(c?.token_holders_count ?? t?.holders_count ?? 0),
          transfers: Number(c?.transfers_count ?? 0),
          iconUrl: tokenLogo(s.address) ?? (t?.icon_url ? String(t.icon_url) : undefined),
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
  [paths.home]: "dashboard-v3",
  [paths.ecosystem]: "ecosystem-v11",
  [paths.protocols]: "protocol-rankings-v11",
  [paths.rankings]: "protocol-rankings-v11",
  [paths.tokens]: "tokens-api-v3",
  [paths.tokensMarketCap]: "tokens-api-v3",
  [paths.nfts]: "tokens-erc721",
  [paths.stablecoins]: "stablecoins-v2",
  [paths.analytics]: "analytics-tx",
  [paths.explorer]: "transactions",
  [paths.blocks]: "blocks",
  [paths.transactions]: "transactions",
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
