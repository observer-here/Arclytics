import { getTokens, getWallets, type TokenFeedRow } from "@/libs/api";
import { arcscan } from "@/libs/arcscan";
import type { ProtocolRanking } from "@/libs/api";

export type AnalyticsPoint = { date: string; value: number };

export type HeatCell = {
  month: string;
  monthKey: string;
  day: number;
  value: number;
  samples: number;
  label: string;
};

export type AnalyticsTokenSlice = {
  topTokens: TokenFeedRow[];
  tokenInflows: TokenFeedRow[];
  tokenOutflows: TokenFeedRow[];
};

export type AnalyticsWalletStats = {
  tracked: number;
  totalValue: number;
  active24h: number;
  txs24h: number;
};

export function buildHeat(series: AnalyticsPoint[]): HeatCell[] {
  const byKey = new Map<
    string,
    { value: number; samples: number; label: string; month: string; monthKey: string; day: number }
  >();
  for (const d of series.slice(-186)) {
    const dt = new Date(`${d.date}T00:00:00Z`);
    if (!Number.isFinite(dt.getTime())) continue;
    const monthKey = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = dt.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
    const day = (dt.getUTCDay() + 6) % 7;
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

export function capitalFlowFrom(rankings: ProtocolRanking[]) {
  const volUp = rankings.filter((r) => (r.change24h ?? 0) >= 0).reduce((s, r) => s + r.volume24h, 0);
  const volDown = rankings.filter((r) => (r.change24h ?? 0) < 0).reduce((s, r) => s + r.volume24h, 0);
  return [
    { label: "Net Inflow", value: Math.max(volUp, 1) },
    { label: "Net Outflow", value: Math.max(volDown, 1) },
  ];
}

export function bridgeShareFrom(rankings: ProtocolRanking[]) {
  const tvlUsd = rankings.reduce((s, r) => s + r.tvlUsd, 0);
  const bridge = rankings.find((r) => /cctp|bridge|gateway/i.test(r.slug + r.name));
  if (bridge) {
    return [
      { label: "CCTP / Bridge", value: bridge.volume24h || bridge.tvlUsd || 1 },
      { label: "Other DeFi", value: Math.max(tvlUsd - (bridge.tvlUsd || 0), 1) },
    ];
  }
  const catMap = rankings.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.tvlUsd;
    return acc;
  }, {});
  return Object.entries(catMap)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
}

export const loadAnalyticsContracts = () =>
  arcscan.statsLine("newContracts").catch(() => [] as AnalyticsPoint[]);

export async function loadAnalyticsTokens(): Promise<AnalyticsTokenSlice> {
  const feed = await getTokens().catch(() => ({ items: [] as TokenFeedRow[] }));
  const items = feed.items ?? [];
  const topTokens = [...items]
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0) || b.interest - a.interest)
    .slice(0, 5);
  const tokenInflows = [...items]
    .filter((t) => (t.change24h ?? 0) >= 0)
    .sort((a, b) => (b.volume24h ?? 0) - (a.volume24h ?? 0))
    .slice(0, 5);
  const tokenOutflows = [...items]
    .filter((t) => (t.change24h ?? 0) < 0)
    .sort((a, b) => (a.change24h ?? 0) - (b.change24h ?? 0))
    .slice(0, 5);
  return {
    topTokens,
    tokenInflows: tokenInflows.length ? tokenInflows : topTokens,
    tokenOutflows: tokenOutflows.length ? tokenOutflows : topTokens.slice().reverse(),
  };
}

export async function loadAnalyticsWallets(): Promise<AnalyticsWalletStats> {
  const wallets = await getWallets().catch(() => ({ items: [], stats: null }));
  const wStats = (wallets.stats ?? {}) as Record<string, number>;
  return {
    tracked: Number(wStats.tracked ?? wallets.items?.length ?? 0),
    totalValue: Number(wStats.totalValue ?? 0),
    active24h: Number(wStats.active24h ?? 0),
    txs24h: Number(wStats.txs24h ?? 0),
  };
}
