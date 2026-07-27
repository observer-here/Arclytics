import { Icons } from "@/components/shared/Icons";
import { StatCard } from "@/components/dashboard/StatCard";
import { AreaChartCard, BarChartCard } from "@/components/charts/Charts";
import { TopProtocols } from "@/components/protocols/TopProtocols";
import { TopTokens } from "@/components/tokens/TopTokens";
import { RecentTransactions } from "@/components/explorer/RecentTransactions";
import { RecentBlocks } from "@/components/explorer/RecentBlocks";
import { NetworkOverview } from "@/components/dashboard/NetworkOverview";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadDashboard } from "@/libs/prefetch";
import { compact, usd } from "@/utils/format";

export function DashboardPage() {
  const { data: loaded, loading, error } = useAsyncData("dashboard", loadDashboard);

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;
  if (!loaded) return null;

  const { data, topTokens } = loaded;
  const spark = (data.txChart ?? []).slice(-14).map((d) => d.transactions_count);
  const chartSeries = (data.txChart ?? [])
    .slice()
    .reverse()
    .map((d) => ({ date: d.date, value: d.transactions_count }));
  const addressSeries = (data.addressChart ?? []).map((d) => ({
    date: d.date,
    value: d.value,
  }));
  const tps = data.stats.transactionsToday > 0 ? data.stats.transactionsToday / 86_400 : undefined;

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Value Locked" value={usd(data.stats.tvlUsd)} icon={<Icons.Tvl size={13} />} series={spark} color="#2563eb" />
        <StatCard label="Total Transactions" value={compact(data.stats.totalTransactions)} icon={<Icons.Tx size={13} />} series={spark} color="#8b5cf6" />
        <StatCard label="Active Addresses" value={compact(data.stats.totalAddresses)} icon={<Icons.Users size={13} />} series={spark} color="#06b6d4" />
        <StatCard label="Total Blocks" value={compact(data.stats.totalBlocks)} icon={<Icons.Blocks size={13} />} series={spark} color="#6366f1" />
        <StatCard label="Gas Used (24h)" value={compact(data.stats.gasUsedToday)} icon={<Icons.Gas size={13} />} series={spark} color="#f59e0b" />
        <StatCard label="Total Contracts" value={compact(data.stats.totalContracts)} icon={<Icons.Contracts size={13} />} series={spark} color="#10b981" />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <AreaChartCard title="New Addresses" data={addressSeries} color="#2563eb" />
        <BarChartCard title="Transactions (Daily)" data={chartSeries} color="#8b5cf6" />
        <BarChartCard title="Volume Proxy" data={chartSeries} color="#06b6d4" />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <TopProtocols rows={data.rankings} />
        <TopTokens rows={topTokens} />
        <NetworkOverview byCategory={data.byCategory} avgBlockTime={data.stats.averageBlockTime} tps={tps} />
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <RecentTransactions />
        <RecentBlocks />
      </div>
    </div>
  );
}
