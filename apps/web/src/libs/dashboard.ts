import { arcscan } from "./arcscan";
import { getProtocolRankings } from "./protocolMetrics";

export { getProtocolRankings } from "./protocolMetrics";
export type { ProtocolRanking } from "./protocolMetrics";

export async function getDashboardData() {
  const [statsRaw, txChart, addressChart, blocks, transactions, contractCountersRaw, rankings] =
    await Promise.all([
      arcscan.stats().catch(() => ({}) as Record<string, unknown>),
      arcscan.txChart().catch(() => ({
        chart_data: [] as Array<{ date: string; transactions_count: number }>,
      })),
      arcscan.newAccountsChart().catch(() => [] as Array<{ date: string; value: number }>),
      arcscan.blocks().catch(() => [] as Array<Record<string, unknown>>),
      arcscan.transactions().catch(() => [] as Array<Record<string, unknown>>),
      arcscan.smartContractCounters().catch(() => ({}) as Record<string, string>),
      getProtocolRankings().catch(() => []),
    ]);

  const stats = statsRaw as Record<string, unknown>;
  const contractCounters = contractCountersRaw as Record<string, string>;
  const totalTvl = rankings.reduce((s, r) => s + r.tvlUsd, 0);
  const byCategory = rankings.reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.tvlUsd;
    return acc;
  }, {});

  return {
    stats: {
      tvlUsd: totalTvl,
      totalTransactions: Number(stats.total_transactions ?? 0),
      totalAddresses: Number(stats.total_addresses ?? 0),
      totalBlocks: Number(stats.total_blocks ?? 0),
      gasUsedToday: Number(stats.gas_used_today ?? 0),
      totalContracts: Number(contractCounters.smart_contracts ?? 0),
      transactionsToday: Number(stats.transactions_today ?? 0),
      averageBlockTime: Number(stats.average_block_time ?? 0),
      latestBlock: blocks[0]?.height ?? blocks[0]?.number ?? null,
    },
    txChart: txChart.chart_data ?? [],
    addressChart,
    rankings,
    byCategory,
    blocks: blocks.slice(0, 12),
    transactions: transactions.slice(0, 12),
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
