import { getProtocolRankings, getTokens } from "./api";
import { arcscan } from "./arcscan";
import { growthFromAdded } from "./seriesChange";

export async function loadDashKpis() {
  const [statsRaw, counters, contractCountersRaw] = await Promise.all([
    arcscan.stats().catch(() => ({}) as Record<string, unknown>),
    arcscan.statsCounters().catch(() => ({}) as Record<string, number>),
    arcscan.smartContractCounters().catch(() => ({}) as Record<string, string>),
  ]);
  const stats = statsRaw as Record<string, unknown>;
  const contractCounters = contractCountersRaw as Record<string, string>;
  const totalTransactions = Number(stats.total_transactions ?? counters.totalTxns ?? 0);
  const totalAddresses = Number(stats.total_addresses ?? counters.totalAddresses ?? 0);
  const totalBlocks = Number(stats.total_blocks ?? counters.totalBlocks ?? 0);
  const totalContracts = Number(
    contractCounters.smart_contracts ?? counters.totalContracts ?? 0,
  );
  const gasFees24h = Number(counters.txnsFee24h ?? 0);
  const newTxns24h = Number(counters.newTxns24h ?? stats.transactions_today ?? 0);
  const avgBlockMs =
    (counters.averageBlockTime ? counters.averageBlockTime * 1000 : 0) ||
    Number(stats.average_block_time ?? 0);
  const newBlocks24h = avgBlockMs > 0 ? Math.round(86_400_000 / avgBlockMs) : 0;
  const newContracts24h = Number(counters.lastNewContracts ?? 0);

  const completed = Number(counters.completedTxns ?? 0);
  const allTx = Number(counters.totalTxns ?? 0);

  return {
    totalTransactions,
    txChange: growthFromAdded(totalTransactions, newTxns24h),
    totalAddresses,
    totalBlocks,
    blockChange: growthFromAdded(totalBlocks, newBlocks24h),
    gasFees24h,
    avgFeeUsdc: Number(counters.averageTxnFee24h ?? 0),
    totalContracts,
    contractChange: growthFromAdded(totalContracts, newContracts24h),
    transactionsToday: Number(stats.transactions_today ?? newTxns24h),
    averageBlockTime: avgBlockMs,
    aaWallets: Number(counters.totalAccountAbstractionWallets ?? 0),
    userOps: Number(counters.totalUserOps ?? 0),
    successRate: allTx > 0 ? Math.min(0.999, completed / allTx) : 0.985,
  };
}

export async function loadDashTokens() {
  const feed = await getTokens().catch(
    () => ({ items: [] as Array<{ address: string; name: string; symbol: string; holders: number; iconUrl?: string }> }),
  );
  return [...(feed.items ?? [])]
    .sort((a, b) => b.holders - a.holders)
    .slice(0, 10)
    .map((t) => ({
      address: t.address,
      name: t.name,
      symbol: t.symbol,
      holdersCount: t.holders,
      iconUrl: t.iconUrl,
    }));
}

export async function loadDashValidators() {
  const items = await arcscan
    .blocksPage(null)
    .then((d) => d.items)
    .catch(() => [] as Array<Record<string, unknown>>);
  return new Set(
    items
      .map((b) => {
        const m = b.miner as { hash?: string } | string | undefined;
        return typeof m === "string" ? m : m?.hash ?? "";
      })
      .filter(Boolean),
  ).size;
}

export const loadDashTxChart = () => arcscan.txChart().catch(() => []);
export const loadDashAddrChart = () => arcscan.newAccountsChart().catch(() => []);
export const loadDashVolChart = () => arcscan.usdcVolumeChart().catch(() => []);
export const loadDashRankings = () => getProtocolRankings().catch(() => []);
