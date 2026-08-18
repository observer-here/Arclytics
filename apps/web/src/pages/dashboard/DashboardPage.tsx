import { MetricCard } from "@/components/ecosystem/MetricCard";
import { Icons } from "@/components/shared/Icons";
import { ChartSkel, TableSkel } from "@/components/shared/Skel";
import { AreaChartCard, BarChartCard } from "@/components/charts/Charts";
import { TopProtocols } from "@/components/protocols/TopProtocols";
import { TopTokens } from "@/components/tokens/TopTokens";
import { RecentTransactions } from "@/components/explorer/RecentTransactions";
import { RecentBlocks } from "@/components/explorer/RecentBlocks";
import { NetworkOverview } from "@/components/dashboard/NetworkOverview";
import { useAsyncData } from "@/hooks/useAsyncData";
import { DASH } from "@/libs/prefetch";
import {
  loadDashAddrChart,
  loadDashKpis,
  loadDashRankings,
  loadDashTokens,
  loadDashTxChart,
  loadDashValidators,
  loadDashVolChart,
} from "@/libs/dashboard";
import { growthFromAdded, lastCompleteValue, weightedChange } from "@/libs/seriesChange";
import { compact, usd, usdc } from "@/utils/format";

export function DashboardPage() {
  const kpis = useAsyncData(DASH.kpis, loadDashKpis);
  const rankings = useAsyncData(DASH.rankings, loadDashRankings);
  const tokens = useAsyncData(DASH.tokens, loadDashTokens);
  const validators = useAsyncData(DASH.validators, loadDashValidators);
  const tx = useAsyncData(DASH.tx, loadDashTxChart);
  const addr = useAsyncData(DASH.addr, loadDashAddrChart);
  const vol = useAsyncData(DASH.vol, loadDashVolChart);

  const s = kpis.data;
  const txSpark = (tx.data ?? []).slice(-14).map((d) => d.value);
  const addrSpark = (addr.data ?? []).slice(-14).map((d) => d.value);
  const tps = s && s.transactionsToday > 0 ? s.transactionsToday / 86_400 : undefined;
  const tvlUsd = rankings.data ? rankings.data.reduce((n, r) => n + r.tvlUsd, 0) : 0;
  const byCategory = (rankings.data ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.category] = (acc[r.category] ?? 0) + r.tvlUsd;
    return acc;
  }, {});
  const addressChange =
    s && addr.data
      ? growthFromAdded(s.totalAddresses, lastCompleteValue(addr.data) ?? 0)
      : undefined;

  return (
    <div className="min-w-0 space-y-2.5">
      <div className="metric-grid xl:grid-cols-6">
        <MetricCard
          label="Total Value Locked"
          value={usd(tvlUsd)}
          change={rankings.data ? weightedChange(rankings.data) : undefined}
          icon={<Icons.Tvl size={13} />}
          color="#2563eb"
          loading={rankings.loading && !rankings.data}
        />
        <MetricCard
          label="Total Transactions"
          value={s ? compact(s.totalTransactions) : "—"}
          change={s?.txChange}
          icon={<Icons.Tx size={13} />}
          series={txSpark}
          color="#8b5cf6"
          loading={kpis.loading && !s}
          hasSpark
        />
        <MetricCard
          label="Total Addresses"
          value={s ? compact(s.totalAddresses) : "—"}
          change={addressChange}
          icon={<Icons.Users size={13} />}
          series={addrSpark}
          color="#06b6d4"
          loading={kpis.loading && !s}
          hasSpark
        />
        <MetricCard
          label="Total Blocks"
          value={s ? compact(s.totalBlocks) : "—"}
          change={s?.blockChange}
          icon={<Icons.Blocks size={13} />}
          color="#6366f1"
          loading={kpis.loading && !s}
        />
        <MetricCard
          label="Gas Fees (24h)"
          value={s ? usdc(s.gasFees24h) : "—"}
          icon={<Icons.Gas size={13} />}
          color="#f59e0b"
          loading={kpis.loading && !s}
        />
        <MetricCard
          label="Total Contracts"
          value={s ? compact(s.totalContracts) : "—"}
          change={s?.contractChange}
          icon={<Icons.Contracts size={13} />}
          color="#10b981"
          loading={kpis.loading && !s}
        />
      </div>

      <div className="grid min-w-0 gap-2 lg:grid-cols-2 xl:grid-cols-3">
        {addr.loading && !addr.data ? (
          <ChartSkel title="New Addresses" kind="area" />
        ) : (
          <AreaChartCard
            title="New Addresses"
            data={addr.data ?? []}
            color="#2563eb"
            mode="flow"
          />
        )}
        {tx.loading && !tx.data ? (
          <ChartSkel title="Transactions (Daily)" />
        ) : (
          <BarChartCard
            title="Transactions (Daily)"
            data={tx.data ?? []}
            color="#8b5cf6"
          />
        )}
        {vol.loading && !vol.data ? (
          <ChartSkel title="USDC Volume" />
        ) : (
          <BarChartCard
            title="USDC Volume"
            data={vol.data ?? []}
            color="#06b6d4"
          />
        )}
      </div>

      <div className="grid min-w-0 gap-2 lg:grid-cols-2 xl:grid-cols-3">
        {rankings.loading && !rankings.data ? (
          <TableSkel title="Top Protocols" />
        ) : (
          <TopProtocols rows={rankings.data ?? []} />
        )}
        {tokens.loading && !tokens.data ? (
          <TableSkel title="Top Tokens" />
        ) : (
          <TopTokens rows={tokens.data ?? []} />
        )}
        <NetworkOverview
          byCategory={rankings.data ? byCategory : undefined}
          validators={validators.data ?? undefined}
          avgBlockTime={s?.averageBlockTime}
          tps={tps}
          avgFeeUsdc={s?.avgFeeUsdc}
        />
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <RecentTransactions />
        <RecentBlocks />
      </div>
    </div>
  );
}
