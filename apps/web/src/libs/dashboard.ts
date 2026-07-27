import { arcscan } from "./arcscan";
import { getProtocolRankings } from "./protocolMetrics";
import { growthFromAdded, lastCompleteValue, weightedChange } from "./seriesChange";

export { getProtocolRankings } from "./protocolMetrics";
export type { ProtocolRanking } from "./protocolMetrics";

export async function getDashboardData() {
  const [
    statsRaw,
    txChart,
    addressChart,
    usdcVolumeChart,
    contractCountersRaw,
    rankings,
    counters,
  ] = await Promise.all([
    arcscan.stats().catch(() => ({}) as Record<string, unknown>),
    arcscan.txChart().catch(() => ({
      chart_data: [] as Array<{ date: string; transactions_count: number }>,
    })),
    arcscan.newAccountsChart().catch(() => [] as Array<{ date: string; value: number; approx?: boolean }>),
    arcscan.usdcVolumeChart().catch(() => [] as Array<{ date: string; value: number; approx?: boolean }>),
    arcscan.smartContractCounters().catch(() => ({}) as Record<string, string>),
    getProtocolRankings().catch(() => []),
    arcscan.statsCounters().catch(() => ({}) as Record<string, number>),
  ]);

  const stats = statsRaw as Record<string, unknown>;
  const contractCounters = contractCountersRaw as Record<string, string>;
  const totalTvl = rankings.reduce((s, r) => s + r.tvlUsd, 0);
  const byCategory = rankings.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.tvlUsd;
    return acc;
  }, {});

  const totalTransactions = Number(stats.total_transactions ?? counters.totalTxns ?? 0);
  const totalAddresses = Number(stats.total_addresses ?? counters.totalAddresses ?? 0);
  const totalBlocks = Number(stats.total_blocks ?? counters.totalBlocks ?? 0);
  const totalContracts = Number(
    contractCounters.smart_contracts ?? counters.totalContracts ?? 0,
  );
  const gasUsedToday = Number(stats.gas_used_today ?? 0);
  const newTxns24h = Number(counters.newTxns24h ?? stats.transactions_today ?? 0);
  const newAccounts24h = lastCompleteValue(addressChart) ?? 0;
  const avgBlockMs =
    Number(stats.average_block_time ?? 0) ||
    (counters.averageBlockTime ? counters.averageBlockTime * 1000 : 0);
  const newBlocks24h = avgBlockMs > 0 ? Math.round(86_400_000 / avgBlockMs) : 0;
  const newContracts24h = Number(counters.lastNewContracts ?? 0);

  return {
    stats: {
      tvlUsd: totalTvl,
      tvlChange: weightedChange(rankings),
      totalTransactions,
      txChange: growthFromAdded(totalTransactions, newTxns24h),
      totalAddresses,
      addressChange: growthFromAdded(totalAddresses, newAccounts24h),
      totalBlocks,
      blockChange: growthFromAdded(totalBlocks, newBlocks24h),
      gasUsedToday,
      gasChange: undefined as number | undefined,
      totalContracts,
      contractChange: growthFromAdded(totalContracts, newContracts24h),
      transactionsToday: Number(stats.transactions_today ?? newTxns24h),
      averageBlockTime: Number(stats.average_block_time ?? 0),
      latestBlock: null as string | number | null,
    },
    txChart: txChart.chart_data ?? [],
    addressChart,
    usdcVolumeChart,
    rankings,
    byCategory,
    blocks: [] as Array<Record<string, unknown>>,
    transactions: [] as Array<Record<string, unknown>>,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
