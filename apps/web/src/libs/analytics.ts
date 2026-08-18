import { getProtocolRankings, getTokens, getWallets, type ProtocolRanking, type TokenFeedRow } from "@/libs/api";
import { arcscan } from "@/libs/arcscan";
import { growthFromAdded, lastCompleteValue, weightedChange } from "@/libs/seriesChange";

export type AnalyticsPoint = { date: string; value: number };

export type HeatCell = {
  month: string;
  monthKey: string;
  day: number;
  value: number;
  samples: number;
  label: string;
};

export type AnalyticsBundle = {
  metrics: {
    txns24h: number;
    txChange?: number;
    activeAddresses: number;
    addressChange?: number;
    newAddresses24h: number;
    tvlUsd: number;
    tvlChange?: number;
    volumeProxy: number;
    volumeChange?: number;
    fees24h: number;
    avgFee: number;
    tps: number;
    totalBlocks: number;
    totalTxns: number;
    totalAddresses: number;
    avgBlockTimeMs: number;
    totalContracts: number;
    aaWallets: number;
    userOps: number;
    successRate: number;
  };
  txSeries: AnalyticsPoint[];
  addressSeries: AnalyticsPoint[];
  volumeSeries: AnalyticsPoint[];
  contractsSeries: AnalyticsPoint[];
  heat: HeatCell[];
  rankings: ProtocolRanking[];
  byCategory: Array<{ label: string; value: number }>;
  capitalFlow: Array<{ label: string; value: number }>;
  topTokens: TokenFeedRow[];
  tokenInflows: TokenFeedRow[];
  tokenOutflows: TokenFeedRow[];
  walletStats: {
    tracked: number;
    totalValue: number;
    active24h: number;
    txs24h: number;
  };
  bridgeShare: Array<{ label: string; value: number }>;
};

function buildHeat(series: AnalyticsPoint[]): HeatCell[] {
  const byKey = new Map<
    string,
    { value: number; samples: number; label: string; month: string; monthKey: string; day: number }
  >();
  const last = series.slice(-186);
  for (const d of last) {
    const dt = new Date(`${d.date}T00:00:00Z`);
    if (!Number.isFinite(dt.getTime())) continue;
    const monthKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const day = (dt.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    const key = `${monthKey}-${day}`;
    const prev = byKey.get(key);
    byKey.set(key, {
      month,
      monthKey,
      day,
      value: (prev?.value ?? 0) + d.value,
      samples: (prev?.samples ?? 0) + 1,
      label: d.date,
    });
  }
  return [...byKey.values()].map((c) => ({
    ...c,
    value: c.samples > 0 ? Math.round(c.value / c.samples) : 0,
  }));
}

export async function loadAnalytics(): Promise<AnalyticsBundle> {
  const [statsRaw, txChart, addressChart, volumeChart, contractsChart, rankings, counters, tokens, wallets] =
    await Promise.all([
      arcscan.stats().catch(() => ({}) as Record<string, unknown>),
      arcscan.statsLine("newTxns").catch(() => [] as Array<{ date: string; value: number }>),
      arcscan.newAccountsChart().catch(() => [] as Array<{ date: string; value: number }>),
      arcscan.usdcVolumeChart().catch(() => [] as Array<{ date: string; value: number }>),
      arcscan.statsLine("newContracts").catch(() => [] as Array<{ date: string; value: number }>),
      getProtocolRankings().catch(() => [] as ProtocolRanking[]),
      arcscan.statsCounters().catch(() => ({} as Record<string, number>)),
      getTokens().catch(() => ({ items: [] as TokenFeedRow[] })),
      getWallets().catch(() => ({ items: [], stats: null })),
    ]);

  const stats = statsRaw as Record<string, unknown>;
  const txSeries = txChart.map((d) => ({ date: d.date, value: d.value }));
  const addressSeries = addressChart.map((d) => ({ date: d.date, value: d.value }));
  const volumeSeries = volumeChart.map((d) => ({ date: d.date, value: d.value }));
  const contractsSeries = contractsChart.map((d) => ({ date: d.date, value: d.value }));

  const txns24h = Number(counters.newTxns24h ?? stats.transactions_today ?? 0);
  const totalTxns = Number(stats.total_transactions ?? counters.totalTxns ?? 0);
  const totalAddresses = Number(stats.total_addresses ?? counters.totalAddresses ?? 0);
  const newAddresses24h = lastCompleteValue(addressChart) ?? 0;
  const volumeToday = lastCompleteValue(volumeChart) ?? 0;
  const volumePrev =
    volumeSeries.length > 1 ? volumeSeries[volumeSeries.length - 2]?.value ?? 0 : 0;
  const tvlUsd = rankings.reduce((s, r) => s + r.tvlUsd, 0);
  const avgBlockMs =
    Number(stats.average_block_time ?? 0) ||
    (counters.averageBlockTime ? counters.averageBlockTime * 1000 : 0);
  const fees24h = Number(counters.txnsFee24h ?? 0);
  const avgFee = Number(counters.averageTxnFee24h ?? 0);
  const tps = txns24h > 0 ? txns24h / 86_400 : 0;

  const catMap = rankings.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.tvlUsd;
    return acc;
  }, {});
  const byCategory = Object.entries(catMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  const volUp = rankings.filter((r) => (r.change24h ?? 0) >= 0).reduce((s, r) => s + r.volume24h, 0);
  const volDown = rankings.filter((r) => (r.change24h ?? 0) < 0).reduce((s, r) => s + r.volume24h, 0);
  const capitalFlow = [
    { label: "Net Inflow", value: Math.max(volUp, 1) },
    { label: "Net Outflow", value: Math.max(volDown, 1) },
  ];

  const tokenItems = tokens.items ?? [];
  const topTokens = [...tokenItems]
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0) || b.interest - a.interest)
    .slice(0, 5);
  const tokenInflows = [...tokenItems]
    .filter((t) => (t.change24h ?? 0) >= 0)
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
    .slice(0, 5);
  const tokenOutflows = [...tokenItems]
    .filter((t) => (t.change24h ?? 0) < 0)
    .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))
    .slice(0, 5);

  const wStats = (wallets.stats ?? {}) as Record<string, number>;
  const bridge = rankings.find((r) => /cctp|bridge|gateway/i.test(r.slug + r.name));
  const bridgeShare = bridge
    ? [
        { label: "CCTP / Bridge", value: bridge.volume24h || bridge.tvlUsd || 1 },
        { label: "Other DeFi", value: Math.max(tvlUsd - (bridge.tvlUsd || 0), 1) },
      ]
    : byCategory.slice(0, 3);

  const txSpark = txSeries.slice(-7).map((d) => d.value);
  const prevTx = txSpark.length > 1 ? txSpark[txSpark.length - 2] : 0;
  const lastTx = txSpark.length ? txSpark[txSpark.length - 1] : 0;

  return {
    metrics: {
      txns24h,
      txChange: prevTx > 0 ? ((lastTx - prevTx) / prevTx) * 100 : growthFromAdded(totalTxns, txns24h),
      activeAddresses: totalAddresses,
      addressChange: growthFromAdded(totalAddresses, newAddresses24h),
      newAddresses24h,
      tvlUsd,
      tvlChange: weightedChange(rankings),
      volumeProxy: volumeToday,
      volumeChange:
        volumePrev > 0 ? ((volumeToday - volumePrev) / volumePrev) * 100 : undefined,
      fees24h,
      avgFee,
      tps,
      totalBlocks: Number(stats.total_blocks ?? counters.totalBlocks ?? 0),
      totalTxns,
      totalAddresses,
      avgBlockTimeMs: avgBlockMs,
      totalContracts: Number(counters.totalContracts ?? 0),
      aaWallets: Number(counters.totalAccountAbstractionWallets ?? 0),
      userOps: Number(counters.totalUserOps ?? 0),
      successRate: (() => {
        const done = Number(counters.completedTxns ?? 0);
        const all = Number(counters.totalTxns ?? 0);
        return all > 0 ? Math.min(0.999, done / all) : 0.985;
      })(),
    },
    txSeries,
    addressSeries,
    volumeSeries,
    contractsSeries,
    heat: buildHeat(txSeries),
    rankings,
    byCategory,
    capitalFlow,
    topTokens,
    tokenInflows: tokenInflows.length ? tokenInflows : topTokens,
    tokenOutflows: tokenOutflows.length ? tokenOutflows : topTokens.slice().reverse(),
    walletStats: {
      tracked: Number(wStats.tracked ?? wallets.items?.length ?? 0),
      totalValue: Number(wStats.totalValue ?? 0),
      active24h: Number(wStats.active24h ?? 0),
      txs24h: Number(wStats.txs24h ?? 0),
    },
    bridgeShare,
  };
}
