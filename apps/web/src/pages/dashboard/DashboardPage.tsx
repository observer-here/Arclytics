import { MetricCard } from "@/components/ecosystem/MetricCard";
import { Icons } from "@/components/shared/Icons";
import { AreaChartCard, BarChartCard } from "@/components/charts/Charts";
import { TopProtocols } from "@/components/protocols/TopProtocols";
import { TopTokens } from "@/components/tokens/TopTokens";
import { RecentTransactions } from "@/components/explorer/RecentTransactions";
import { RecentBlocks } from "@/components/explorer/RecentBlocks";
import { NetworkOverview } from "@/components/dashboard/NetworkOverview";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadDashboard } from "@/libs/prefetch";
import { compact, usd, usdc } from "@/utils/format";

export function DashboardPage() {
  const { data: loaded, loading, error } = useAsyncData("dashboard-v7", loadDashboard);

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;
  if (!loaded) return null;

  const { data, topTokens } = loaded;
  const txSpark = (data.txChart ?? []).slice(-14).map((d) => d.value);
  const addrSpark = (data.addressChart ?? []).slice(-14).map((d) => d.value);
  const chartSeries = (data.txChart ?? []).map((d) => ({ date: d.date, value: d.value }));
  const addressSeries = (data.addressChart ?? []).map((d) => ({
    date: d.date,
    value: d.value,
  }));
  const usdcVolumeSeries = (data.usdcVolumeChart ?? []).map((d) => ({
    date: d.date,
    value: d.value,
  }));
  const tps = data.stats.transactionsToday > 0 ? data.stats.transactionsToday / 86_400 : undefined;

  return (
    <div className="space-y-2.5">
      <div className="metric-grid xl:grid-cols-6">
        <MetricCard label="Total Value Locked" value={usd(data.stats.tvlUsd)} change={data.stats.tvlChange} icon={<Icons.Tvl size={13} />} color="#2563eb" />
        <MetricCard label="Total Transactions" value={compact(data.stats.totalTransactions)} change={data.stats.txChange} icon={<Icons.Tx size={13} />} series={txSpark} color="#8b5cf6" />
        <MetricCard label="Total Addresses" value={compact(data.stats.totalAddresses)} change={data.stats.addressChange} icon={<Icons.Users size={13} />} series={addrSpark} color="#06b6d4" />
        <MetricCard label="Total Blocks" value={compact(data.stats.totalBlocks)} change={data.stats.blockChange} icon={<Icons.Blocks size={13} />} color="#6366f1" />
        <MetricCard label="Gas Fees (24h)" value={usdc(data.stats.gasFees24h)} icon={<Icons.Gas size={13} />} color="#f59e0b" />
        <MetricCard label="Total Contracts" value={compact(data.stats.totalContracts)} change={data.stats.contractChange} icon={<Icons.Contracts size={13} />} color="#10b981" />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <AreaChartCard title="New Addresses" data={addressSeries} color="#2563eb" mode="flow" />
        <BarChartCard title="Transactions (Daily)" data={chartSeries} color="#8b5cf6" defaultRange="1Y" />
        <BarChartCard title="USDC Volume" data={usdcVolumeSeries} color="#06b6d4" />
      </div>

      <div className="grid gap-2 lg:grid-cols-2 xl:grid-cols-3">
        <TopProtocols rows={data.rankings} />
        <TopTokens rows={topTokens} />
        <NetworkOverview
          byCategory={data.byCategory}
          validators={data.stats.validators}
          avgBlockTime={data.stats.averageBlockTime}
          tps={tps}
          avgFeeUsdc={data.stats.avgFeeUsdc}
        />
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <RecentTransactions />
        <RecentBlocks />
      </div>
    </div>
  );
}
