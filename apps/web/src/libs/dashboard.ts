import { getProtocolRankings } from "./api";
import { arcscan } from "./arcscan";
import { growthFromAdded, lastCompleteValue, weightedChange } from "./seriesChange";

export { getProtocolRankings };

export async function getDashboardData() {
  const [
    statsRaw,
    txChart,
    addressChart,
    usdcVolumeChart,
    contractCountersRaw,
    rankings,
    counters,
    recentBlocks,
  ] = await Promise.all([
    arcscan.stats().catch(() => ({}) as Record<string, unknown>),
    arcscan.txChart().catch(() => [] as Array<{ date: string; value: number; approx?: boolean }>),
    arcscan.newAccountsChart().catch(() => [] as Array<{ date: string; value: number; approx?: boolean }>),
    arcscan.usdcVolumeChart().catch(() => [] as Array<{ date: string; value: number; approx?: boolean }>),
    arcscan.smartContractCounters().catch(() => ({}) as Record<string, string>),
    getProtocolRankings().catch(() => []),
    arcscan.statsCounters().catch(() => ({}) as Record<string, number>),
    arcscan.blocksPage(null).then((d) => d.items).catch(() => [] as Array<Record<string, unknown>>),
  ]);

  const stats = statsRaw as Record<string, unknown>;
  const contractCounters = contractCountersRaw as Record<string, string>;
  const totalTvl = rankings.reduce((s, r) => s + r.tvlUsd, 0);

  const totalTransactions = Number(stats.total_transactions ?? counters.totalTxns ?? 0);
  const totalAddresses = Number(stats.total_addresses ?? counters.totalAddresses ?? 0);
  const totalBlocks = Number(stats.total_blocks ?? counters.totalBlocks ?? 0);
  const totalContracts = Number(
    contractCounters.smart_contracts ?? counters.totalContracts ?? 0,
  );
  const gasFees24h = Number(counters.txnsFee24h ?? 0);
  const newTxns24h = Number(counters.newTxns24h ?? stats.transactions_today ?? 0);
  const newAccounts24h = lastCompleteValue(addressChart) ?? 0;
  const avgBlockMs =
    (counters.averageBlockTime ? counters.averageBlockTime * 1000 : 0) ||
    Number(stats.average_block_time ?? 0);
  const newBlocks24h = avgBlockMs > 0 ? Math.round(86_400_000 / avgBlockMs) : 0;
  const newContracts24h = Number(counters.lastNewContracts ?? 0);
  const validators = new Set(
    recentBlocks
      .map((b) => {
        const m = b.miner as { hash?: string } | string | undefined;
        return typeof m === "string" ? m : m?.hash ?? "";
      })
      .filter(Boolean),
  ).size;

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
      gasFees24h,
      avgFeeUsdc: Number(counters.averageTxnFee24h ?? 0),
      totalContracts,
      contractChange: growthFromAdded(totalContracts, newContracts24h),
      transactionsToday: Number(stats.transactions_today ?? newTxns24h),
      averageBlockTime: avgBlockMs,
      validators,
    },
    txChart,
    addressChart,
    usdcVolumeChart,
    rankings,
    byCategory: rankings.reduce<Record<string, number>>((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + r.tvlUsd;
      return acc;
    }, {}),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
