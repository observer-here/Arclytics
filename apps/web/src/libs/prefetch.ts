import { addresses } from "@arclytics/chain";
import { getProtocolRankings, loadEcosystemFeed } from "@/libs/api";
import { arcscan } from "@/libs/arcscan";
import { getDashboardData } from "@/libs/dashboard";
import { prefetch } from "@/libs/queryCache";
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
  return loadEcosystemFeed();
}

const routeLoaders: Record<string, () => Promise<unknown>> = {
  [paths.home]: loadDashboard,
  [paths.ecosystem]: loadEcosystem,
  [paths.protocols]: () => getProtocolRankings().catch(() => []),
  [paths.rankings]: () => getProtocolRankings().catch(() => []),
  [paths.tokens]: async () => {
    const { LEGIT_TOKENS } = await import("@/config/tokens");
    const { arcscan } = await import("@/libs/arcscan");
    const settled = await Promise.all(
      LEGIT_TOKENS.map(async (meta) => {
        const t = await arcscan.token(meta.address).catch(() => null);
        if (!t || (t as { message?: string }).message) return null;
        const address = String(t.address_hash ?? meta.address);
        const name = String(t.name ?? "");
        const symbol = String(t.symbol ?? "");
        if (!name && !symbol) return null;
        const rate = t.exchange_rate != null ? Number(t.exchange_rate) : null;
        const price =
          rate != null && Number.isFinite(rate) && rate > 0
            ? rate
            : meta.pegUsd
              ? 1
              : null;
        const mcapRaw =
          t.circulating_market_cap != null ? Number(t.circulating_market_cap) : null;
        const vol = t.volume_24h != null ? Number(t.volume_24h) : null;
        return {
          address,
          name,
          symbol,
          holders: Number(t.holders_count ?? 0),
          iconUrl: t.icon_url ? String(t.icon_url) : undefined,
          price,
          change24h: price != null ? 0 : null,
          change7d: price != null ? 0 : null,
          marketCap:
            mcapRaw != null && Number.isFinite(mcapRaw) && mcapRaw > 0 ? mcapRaw : null,
          volume24h: vol != null && Number.isFinite(vol) ? vol : null,
          category: meta.category,
          protocol: meta.protocol,
        };
      }),
    );
    return settled.filter(Boolean);
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
  [paths.ecosystem]: "ecosystem-v8",
  [paths.protocols]: "protocol-rankings-v8",
  [paths.rankings]: "protocol-rankings-v8",
  [paths.tokens]: "tokens-legit-v3",
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
