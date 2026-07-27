import { AreaChartCard, BarChartCard } from "@/components/charts/Charts";
import { useAsyncData } from "@/hooks/useAsyncData";
import { arcscan } from "@/libs/arcscan";

export function AnalyticsPage() {
  const { data: series, loading, error } = useAsyncData("analytics-tx", async () => {
    const chart = await arcscan.txChart().catch(() => ({ chart_data: [] }));
    return (chart.chart_data ?? [])
      .slice()
      .reverse()
      .map((d) => ({ date: d.date, value: d.transactions_count }));
  });

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  return (
    <div className="space-y-2.5">
      <div className="grid gap-4 xl:grid-cols-2">
        <AreaChartCard title="Network Activity" data={series ?? []} color="#2563eb" />
        <BarChartCard title="Transactions (Daily)" data={series ?? []} color="#8b5cf6" />
      </div>
    </div>
  );
}
