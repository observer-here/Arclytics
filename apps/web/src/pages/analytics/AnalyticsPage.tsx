import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DonutChart } from "@/components/charts/Charts";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import { Icons } from "@/components/shared/Icons";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import { Skel } from "@/components/shared/Skel";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  bridgeShareFrom,
  buildHeat,
  capitalFlowFrom,
  loadAnalyticsContracts,
  loadAnalyticsTokens,
  loadAnalyticsWallets,
  type AnalyticsPoint,
  type HeatCell,
} from "@/libs/analytics";
import {
  loadDashAddrChart,
  loadDashKpis,
  loadDashRankings,
  loadDashTxChart,
  loadDashVolChart,
} from "@/libs/dashboard";
import { ANALYTICS, DASH } from "@/libs/prefetch";
import { growthFromAdded, lastCompleteValue, weightedChange } from "@/libs/seriesChange";
import { paths } from "@/routes/paths";
import { compact, pct, usd, usdc } from "@/utils/format";

const DONUT = ["#8b5cf6", "#3b82f6", "#06b6d4", "#10b981", "#f97316", "#94a3b8"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const CHART_RANGES = ["7D", "30D", "90D", "180D", "1Y"] as const;

type ChartTab = "tx" | "active" | "new" | "fees" | "contracts";
type FlowTab = "in" | "out";

function sliceRange(data: AnalyticsPoint[], range: string) {
  const n =
    range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : range === "180D" ? 180 : 365;
  return data.slice(-Math.min(n, data.length));
}

const HEAT_COLORS = ["#0b1f3a", "#0c4a6e", "#0369a1", "#0ea5e9", "#22d3ee", "#a5f3fc"];

function HeatSkel() {
  return (
    <div className="card flex h-full flex-col p-2">
      <div className="panel-title mb-1.5">On-Chain Activity Heatmap</div>
      <div
        className="grid min-h-0 flex-1 gap-1"
        style={{ gridTemplateColumns: `30px repeat(7, minmax(0, 1fr))` }}
      >
        <div />
        {DAYS.map((d) => (
          <div key={d} className="text-center text-[9px] font-medium text-ink-400">
            {d}
          </div>
        ))}
        {Array.from({ length: 6 }, (_, m) => [
          <Skel key={`ml-${m}`} className="h-3 w-6 justify-self-end" />,
          ...DAYS.map((_, d) => (
            <Skel key={`c-${m}-${d}`} className="min-h-[16px] rounded-[3px]" />
          )),
        ])}
      </div>
    </div>
  );
}

function NetworkSkel() {
  return (
    <div className="card p-2 text-[11px]">
      <div className="panel-title mb-1.5">Network Overview</div>
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex justify-between gap-2">
            <Skel className="h-3 w-24" />
            <Skel className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DonutSkel({ title }: { title: string }) {
  return (
    <div className="card p-2">
      <div className="panel-title mb-2">{title}</div>
      <div className="flex items-center gap-3">
        <Skel className="h-24 w-24 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skel className="h-3 w-full" />
          <Skel className="h-3 w-4/5" />
          <Skel className="h-3 w-3/5" />
        </div>
      </div>
    </div>
  );
}

function TokenListSkel({ title, rows = 5 }: { title: string; rows?: number }) {
  return (
    <div className="card p-2">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="panel-title">{title}</div>
        <Skel className="h-3 w-12" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skel className="h-4 w-4 rounded" />
            <Skel className="h-3 flex-1" />
            <Skel className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WidgetSkel({ title }: { title: string }) {
  return (
    <div className="card p-2">
      <div className="panel-title mb-1.5">{title}</div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="space-y-1">
            <Skel className="h-2.5 w-14" />
            <Skel className="h-4 w-16" />
          </div>
        ))}
      </div>
      <Skel className="mt-2 h-8 w-full" />
    </div>
  );
}

function ProtocolTableSkel() {
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink-100 px-2 py-1.5">
        <div className="panel-title">Protocol Analytics</div>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <Skel key={i} className="h-5 w-12 rounded-full" />
          ))}
        </div>
      </div>
      <div className="space-y-2 p-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-2">
            <Skel className="h-3 w-4" />
            <Skel className="h-4 w-4 rounded" />
            <Skel className="h-3 flex-1" />
            <Skel className="h-3 w-14" />
            <Skel className="h-3 w-14" />
            <Skel className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityHeatmap({ cells }: { cells: HeatCell[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    label: string;
    value: number;
    x: number;
    y: number;
  } | null>(null);

  const monthKeys = [...new Set(cells.map((c) => c.monthKey))].sort().slice(-6);
  const monthLabel = new Map(cells.map((c) => [c.monthKey, c.month]));
  const max = Math.max(...cells.map((c) => c.value), 1);
  const map = new Map(cells.map((c) => [`${c.monthKey}-${c.day}`, c]));

  const color = (v: number) => {
    if (v <= 0) return HEAT_COLORS[0];
    const t = v / max;
    const i = Math.min(HEAT_COLORS.length - 1, Math.floor(t * (HEAT_COLORS.length - 1) + 0.001));
    return HEAT_COLORS[i];
  };

  const showTip = (label: string, value: number, clientX: number, clientY: number) => {
    const el = box.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setTip({
      label,
      value,
      x: Math.min(r.width - 8, Math.max(8, clientX - r.left)),
      y: Math.max(12, clientY - r.top),
    });
  };

  return (
    <div
      ref={box}
      className="card relative flex h-full flex-col p-2"
      onMouseLeave={() => setTip(null)}
    >
      <div className="panel-title mb-1.5">On-Chain Activity Heatmap</div>
      {tip && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] shadow-sm"
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="font-medium text-ink-700">{tip.label}</div>
          <div className="text-ink-500">{compact(tip.value)} avg txs</div>
        </div>
      )}
      <div className="min-h-0 flex-1">
        <div
          className="grid h-full gap-1"
          style={{ gridTemplateColumns: `30px repeat(7, minmax(0, 1fr))` }}
        >
          <div />
          {DAYS.map((d) => (
            <div key={d} className="text-center text-[9px] font-medium text-ink-400">
              {d}
            </div>
          ))}
          {monthKeys.flatMap((mk) => [
            <div
              key={`m-${mk}`}
              className="flex items-center justify-end pr-1 text-[10px] text-ink-500"
            >
              {monthLabel.get(mk) ?? mk}
            </div>,
            ...DAYS.map((_, day) => {
              const cell = map.get(`${mk}-${day}`);
              const v = cell?.value ?? 0;
              const label = `${monthLabel.get(mk)} ${DAYS[day]}`;
              return (
                <div
                  key={`${mk}-${day}`}
                  className="min-h-[16px] cursor-crosshair rounded-[3px] transition-opacity hover:opacity-85"
                  style={{ background: color(v) }}
                  onMouseEnter={(e) => showTip(label, v, e.clientX, e.clientY)}
                  onMouseMove={(e) => showTip(label, v, e.clientX, e.clientY)}
                />
              );
            }),
          ])}
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-ink-400">
        <div className="flex items-center gap-1">
          <span>Low</span>
          {HEAT_COLORS.map((c) => (
            <span key={c} className="h-2 w-2 rounded-[2px]" style={{ background: c }} />
          ))}
          <span>High</span>
        </div>
        <span>Last 6 months · daily txs</span>
      </div>
    </div>
  );
}

function ActivityLines({
  data,
  successRate,
}: {
  data: AnalyticsPoint[];
  successRate: number;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{
    i: number;
    x: number;
    y: number;
    right: boolean;
  } | null>(null);

  const total = data;
  const showSplit = successRate < 1;
  const ok = data.map((d) => ({ date: d.date, value: d.value * successRate }));
  const fail = data.map((d) => ({
    date: d.date,
    value: Math.max(0, d.value * (1 - successRate)),
  }));
  const max = Math.max(...total.map((d) => d.value), 1);
  const w = 560;
  const h = 132;
  const padL = 48;
  const padR = 32;
  const padT = 8;
  const padB = 18;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;
  const n = Math.max(total.length - 1, 1);

  const pathOf = (pts: AnalyticsPoint[]) =>
    pts
      .map((d, i) => {
        const x = padL + (i / n) * innerW;
        const y = padT + innerH - (d.value / max) * innerH;
        return `${i === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");

  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const xLabels =
    total.length <= 8
      ? total.map((d, i) => ({ i, label: d.date.slice(5) }))
      : [0, 0.25, 0.5, 0.75, 1].map((t) => {
          const i = Math.round(t * (total.length - 1));
          return { i, label: total[i]?.date.slice(5) ?? "" };
        });

  const showAt = (i: number, clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !total[i]) return;
    const r = el.getBoundingClientRect();
    const x = clientX - r.left;
    const right = x > r.width - 80;
    setTip({
      i,
      x: right ? r.width - 10 : Math.max(10, x),
      y: Math.max(10, clientY - r.top - 6),
      right,
    });
  };

  const tipPt = tip ? total[tip.i] : null;

  return (
    <div ref={box} className="relative" onMouseLeave={() => setTip(null)}>
      {tip && tipPt && (
        <div
          className={`pointer-events-none absolute z-10 -translate-y-full rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] shadow-sm ${
            tip.right ? "-translate-x-full" : "-translate-x-1/2"
          }`}
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="font-medium text-ink-700">{tipPt.date}</div>
          <div className="mt-0.5 space-y-0.5 text-ink-600">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
              {compact(tipPt.value)}
            </div>
            {showSplit && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {compact(ok[tip.i].value)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {compact(fail[tip.i].value)}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[132px] w-full" preserveAspectRatio="none">
        {ticks.map((t) => {
          const y = padT + innerH - t * innerH;
          return (
            <g key={t}>
              <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="fill-ink-400" fontSize="8">
                {compact(max * t)}
              </text>
            </g>
          );
        })}
        <path d={pathOf(total)} fill="none" stroke="#8b5cf6" strokeWidth="2.2" />
        {showSplit && (
          <>
            <path d={pathOf(ok)} fill="none" stroke="#10b981" strokeWidth="1.8" />
            <path d={pathOf(fail)} fill="none" stroke="#f43f5e" strokeWidth="1.6" />
          </>
        )}
        {tip && tipPt && (
          <line
            x1={padL + (tip.i / n) * innerW}
            x2={padL + (tip.i / n) * innerW}
            y1={padT}
            y2={padT + innerH}
            stroke="#94a3b8"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
        )}
        {total.map((d, i) => {
          const x = padL + (i / n) * innerW;
          const yT = padT + innerH - (d.value / max) * innerH;
          const active = tip?.i === i;
          return (
            <g key={d.date}>
              <circle cx={x} cy={yT} r={active ? 3.2 : 2} fill="#8b5cf6" />
              {showSplit && (
                <>
                  <circle
                    cx={x}
                    cy={padT + innerH - (ok[i].value / max) * innerH}
                    r={active ? 2.6 : 1.6}
                    fill="#10b981"
                  />
                  <circle
                    cx={x}
                    cy={padT + innerH - (fail[i].value / max) * innerH}
                    r={active ? 2.4 : 1.4}
                    fill="#f43f5e"
                  />
                </>
              )}
            </g>
          );
        })}
        {xLabels.map(({ i, label }) => {
          const x = padL + (i / n) * innerW;
          return (
            <text
              key={`x-${i}`}
              x={x}
              y={h - 6}
              textAnchor={i === xLabels.at(-1)?.i ? "end" : i === xLabels[0]?.i ? "start" : "middle"}
              className="fill-ink-400"
              fontSize="9"
            >
              {label}
            </text>
          );
        })}
        {total.map((d, i) => {
          const x0 = padL + ((i - 0.5) / n) * innerW;
          const x1 = padL + ((i + 0.5) / n) * innerW;
          return (
            <rect
              key={`hit-${d.date}`}
              x={Math.max(padL, x0)}
              y={padT}
              width={Math.max(4, x1 - x0)}
              height={innerH}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={(e) => showAt(i, e.clientX, e.clientY)}
              onMouseMove={(e) => showAt(i, e.clientX, e.clientY)}
            />
          );
        })}
      </svg>
    </div>
  );
}

function MiniSpark({ series, color }: { series: number[]; color: string }) {
  if (series.length < 2) return <div className="mt-2 h-8" />;
  const max = Math.max(...series, 1);
  const min = Math.min(...series);
  const span = max - min || 1;
  const pts = series
    .map((v, i) => `${(i / (series.length - 1)) * 100},${28 - ((v - min) / span) * 22}`)
    .join(" ");
  return (
    <svg className="mt-1 h-8 w-full" viewBox="0 0 100 32" preserveAspectRatio="none">
      <polyline fill="none" stroke={color} strokeWidth="1.6" points={pts} />
    </svg>
  );
}

export function AnalyticsPage() {
  const kpis = useAsyncData(DASH.kpis, loadDashKpis);
  const rankings = useAsyncData(DASH.rankings, loadDashRankings);
  const tx = useAsyncData(DASH.tx, loadDashTxChart);
  const addr = useAsyncData(DASH.addr, loadDashAddrChart);
  const vol = useAsyncData(DASH.vol, loadDashVolChart);
  const contracts = useAsyncData(ANALYTICS.contracts, loadAnalyticsContracts);
  const tokens = useAsyncData(ANALYTICS.tokens, loadAnalyticsTokens);
  const wallets = useAsyncData(ANALYTICS.wallets, loadAnalyticsWallets);

  const [chartRange, setChartRange] = useState<(typeof CHART_RANGES)[number]>("30D");
  const [chartTab, setChartTab] = useState<ChartTab>("tx");
  const [protoFilter, setProtoFilter] = useState("all");
  const [flowTab, setFlowTab] = useState<FlowTab>("in");

  const s = kpis.data;
  const ranks = rankings.data ?? [];
  const txSeries = tx.data ?? [];
  const addressSeries = addr.data ?? [];
  const volumeSeries = vol.data ?? [];
  const contractsSeries = contracts.data ?? [];

  const categories = useMemo(() => {
    const set = new Set(ranks.map((r) => r.category));
    return ["all", ...[...set].sort()];
  }, [ranks]);

  const protocols = useMemo(() => {
    return (protoFilter === "all" ? ranks : ranks.filter((r) => r.category === protoFilter)).slice(
      0,
      12,
    );
  }, [ranks, protoFilter]);

  const heat = useMemo(() => (tx.data ? buildHeat(tx.data) : []), [tx.data]);
  const capitalFlow = useMemo(() => capitalFlowFrom(ranks), [ranks]);
  const bridgeShare = useMemo(() => bridgeShareFrom(ranks), [ranks]);

  const txns24h = s?.transactionsToday ?? 0;
  const tvlUsd = ranks.reduce((n, r) => n + r.tvlUsd, 0);
  const totalTvl = tvlUsd || 1;
  const newAddresses24h = lastCompleteValue(addressSeries) ?? 0;
  const volumeToday = lastCompleteValue(volumeSeries) ?? 0;
  const volumePrev =
    volumeSeries.length > 1 ? volumeSeries[volumeSeries.length - 2]?.value ?? 0 : 0;
  const tps = txns24h > 0 ? txns24h / 86_400 : 0;
  const successRate = s?.successRate ?? 1;

  const txSpark = txSeries.slice(-14).map((d) => d.value);
  const addrSpark = addressSeries.slice(-14).map((d) => d.value);
  const volSpark = volumeSeries.slice(-14).map((d) => d.value);
  const prevTx = txSpark.length > 1 ? txSpark[txSpark.length - 2] : 0;
  const lastTx = txSpark.length ? txSpark[txSpark.length - 1] : 0;
  const txChange =
    prevTx > 0
      ? ((lastTx - prevTx) / prevTx) * 100
      : s
        ? growthFromAdded(s.totalTransactions, txns24h)
        : undefined;

  const chartData = sliceRange(
    chartTab === "active" || chartTab === "new"
      ? addressSeries
      : chartTab === "fees"
        ? volumeSeries
        : chartTab === "contracts"
          ? contractsSeries
          : txSeries,
    chartRange,
  );

  const chartLoading =
    chartTab === "active" || chartTab === "new"
      ? addr.loading && !addr.data
      : chartTab === "fees"
        ? vol.loading && !vol.data
        : chartTab === "contracts"
          ? contracts.loading && !contracts.data
          : tx.loading && !tx.data;

  const netFlow = capitalFlow[0].value - capitalFlow[1].value;
  const flowList =
    flowTab === "in" ? (tokens.data?.tokenInflows ?? []) : (tokens.data?.tokenOutflows ?? []);

  const kpisLoading = kpis.loading && !s;
  const tvlLoading = rankings.loading && !rankings.data;
  const txLoading = tx.loading && !tx.data;
  const addrLoading = addr.loading && !addr.data;
  const volLoading = vol.loading && !vol.data;

  return (
    <div className="space-y-2">
      <div className="metric-grid xl:grid-cols-7">
        <MetricCard
          label="Transactions"
          value={compact(txns24h)}
          change={txChange}
          icon={<Icons.Tx size={13} />}
          series={txSpark}
          color="#8b5cf6"
          loading={kpisLoading}
          hasSpark
        />
        <MetricCard
          label="Active Addresses"
          value={s ? compact(s.totalAddresses) : "—"}
          change={s ? growthFromAdded(s.totalAddresses, newAddresses24h) : undefined}
          icon={<Icons.Users size={13} />}
          series={addrSpark}
          color="#3b82f6"
          loading={kpisLoading}
          hasSpark
        />
        <MetricCard
          label="New Addresses"
          value={compact(newAddresses24h)}
          icon={<Icons.Activity size={13} />}
          series={addrSpark}
          color="#06b6d4"
          loading={addrLoading}
          hasSpark
        />
        <MetricCard
          label="TVL"
          value={usd(tvlUsd)}
          change={rankings.data ? weightedChange(rankings.data) : undefined}
          icon={<Icons.Tvl size={13} />}
          color="#2563eb"
          loading={tvlLoading}
        />
        <MetricCard
          label="Total Volume"
          value={compact(volumeToday)}
          change={
            volumePrev > 0 ? ((volumeToday - volumePrev) / volumePrev) * 100 : undefined
          }
          icon={<Icons.Volume size={13} />}
          series={volSpark}
          color="#0ea5e9"
          loading={volLoading}
          hasSpark
        />
        <MetricCard
          label="Fees (USDC)"
          value={s ? usdc(s.gasFees24h) : "—"}
          icon={<Icons.Fees size={13} />}
          color="#f59e0b"
          loading={kpisLoading}
        />
        <MetricCard
          label="TPS (Live)"
          value={tps.toFixed(1)}
          icon={<Icons.Analytics size={13} />}
          series={txSpark}
          color="#10b981"
          loading={kpisLoading}
          hasSpark
        />
      </div>

      <div className="grid items-stretch gap-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="card p-2">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
            <div className="panel-title">On-Chain Activity</div>
            <select
              value={chartRange}
              onChange={(e) => setChartRange(e.target.value as (typeof CHART_RANGES)[number])}
              className="rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] text-ink-600"
            >
              {CHART_RANGES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-1.5 no-scrollbar flex gap-1 overflow-x-auto">
            {(
              [
                ["tx", "Transactions"],
                ["active", "Active Addresses"],
                ["new", "New Addresses"],
                ["fees", "Fees"],
                ["contracts", "CA Deployed"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setChartTab(id)}
                className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                  chartTab === id
                    ? "bg-violet-600 text-white"
                    : "bg-ink-50 text-ink-500 hover:bg-ink-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {chartLoading ? (
            <div className="h-[132px]">
              <Skel className="h-full w-full rounded" />
            </div>
          ) : (
            <>
              {chartTab === "tx" && (
                <div className="mb-1 flex flex-wrap gap-2.5 text-[9px] text-ink-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Total
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Successful
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" /> Failed
                  </span>
                </div>
              )}
              <ActivityLines
                data={chartData}
                successRate={chartTab === "tx" ? successRate : 1}
              />
            </>
          )}
        </div>

        {txLoading ? <HeatSkel /> : <ActivityHeatmap cells={heat} />}

        {kpisLoading ? (
          <NetworkSkel />
        ) : (
          <div className="card p-2 text-[11px]">
            <div className="panel-title mb-1.5">Network Overview</div>
            <dl className="space-y-1 text-ink-500">
              <div className="flex justify-between gap-2">
                <dt>Average Block Time</dt>
                <dd className="font-medium text-ink-800">
                  {s && s.averageBlockTime > 0
                    ? `${(s.averageBlockTime / 1000).toFixed(2)}s`
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Total Blocks</dt>
                <dd className="font-medium text-ink-800">{compact(s?.totalBlocks ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Total Addresses</dt>
                <dd className="font-medium text-ink-800">{compact(s?.totalAddresses ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Gas Fees (24h)</dt>
                <dd className="font-medium text-ink-800">{usdc(s?.gasFees24h ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Total Transactions</dt>
                <dd className="font-medium text-ink-800">{compact(s?.totalTransactions ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Avg Fee</dt>
                <dd className="font-medium text-ink-800">
                  {s && s.avgFeeUsdc > 0 ? usdc(s.avgFeeUsdc) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Contracts</dt>
                <dd className="font-medium text-ink-800">{compact(s?.totalContracts ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>TPS (Live)</dt>
                <dd className="font-medium text-ink-800">{tps.toFixed(1)}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>

      <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,3fr)_minmax(220px,1fr)]">
        {tvlLoading ? (
          <ProtocolTableSkel />
        ) : (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-2 py-1.5">
              <div className="panel-title">Protocol Analytics</div>
              <div className="no-scrollbar flex max-w-full gap-1 overflow-x-auto">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setProtoFilter(c)}
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      protoFilter === c ? "bg-violet-600 text-white" : "bg-ink-50 text-ink-500"
                    }`}
                  >
                    {c === "all" ? "All" : (CATEGORY_LABELS[c as ProtocolCategoryFilter] ?? c)}
                  </button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                    <th className="px-2 py-1.5 font-medium">#</th>
                    <th className="px-2 py-1.5 font-medium">Protocol</th>
                    <th className="px-2 py-1.5 font-medium">Category</th>
                    <th className="px-2 py-1.5 text-right font-medium">TVL</th>
                    <th className="px-2 py-1.5 text-right font-medium">Volume (24H)</th>
                    <th className="px-2 py-1.5 text-right font-medium">Fees (24H)</th>
                    <th className="px-2 py-1.5 text-right font-medium">Users</th>
                    <th className="px-2 py-1.5 text-right font-medium">Txns</th>
                    <th className="px-2 py-1.5 font-medium">Market Share</th>
                  </tr>
                </thead>
                <tbody>
                  {protocols.map((r, i) => {
                    const share = Math.min(100, (r.tvlUsd / totalTvl) * 100);
                    return (
                      <tr key={r.slug} className="border-b border-ink-50 hover:bg-ink-50">
                        <td className="px-2 py-1.5 text-ink-400">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          <Link
                            to={paths.protocol(r.slug)}
                            className="inline-flex items-center gap-1.5 font-medium text-ink-800"
                          >
                            <ProtocolIcon
                              slug={r.slug}
                              name={r.name}
                              category={r.category}
                              size={16}
                            />
                            <span className="truncate">{r.name}</span>
                          </Link>
                        </td>
                        <td className="px-2 py-1.5">
                          <span className="rounded-full bg-violet-50 px-1.5 py-0.5 text-[9px] text-violet-700">
                            {CATEGORY_LABELS[r.category as ProtocolCategoryFilter] ?? r.category}
                          </span>
                        </td>
                        <td className="px-2 py-1.5 text-right font-medium">{usd(r.tvlUsd)}</td>
                        <td className="px-2 py-1.5 text-right text-ink-600">{usd(r.volume24h)}</td>
                        <td className="px-2 py-1.5 text-right text-ink-600">
                          {r.fees24h != null ? usd(r.fees24h) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-right text-ink-600">
                          {compact(r.activeUsers24h ?? 0)}
                        </td>
                        <td className="px-2 py-1.5 text-right text-ink-600">{compact(r.txs)}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-ink-100">
                              <div
                                className="h-full rounded-full bg-violet-500"
                                style={{ width: `${share}%` }}
                              />
                            </div>
                            <span className="text-[10px] text-ink-400">{share.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <aside className="space-y-2">
          {tvlLoading ? (
            <DonutSkel title="Capital Flow (24H)" />
          ) : (
            <div className="card p-2">
              <div className="panel-title mb-1">Capital Flow (24H)</div>
              <div className="mb-1 text-[15px] font-semibold text-ink-900">
                {usd(Math.abs(netFlow))}
                <span className="ml-1 text-[10px] font-medium text-ink-400">Net Flow</span>
              </div>
              <DonutChart
                title="Flow split"
                slices={capitalFlow}
                colors={["#10b981", "#f43f5e"]}
                bare
              />
            </div>
          )}

          {tokens.loading && !tokens.data ? (
            <TokenListSkel title="Top Tokens by Volume (24H)" />
          ) : (
            <div className="card p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <div className="panel-title">Top Tokens by Volume (24H)</div>
                <Link to={paths.tokens} className="text-[10px] font-medium text-arc-600">
                  View all
                </Link>
              </div>
              <div className="space-y-1.5">
                {(tokens.data?.topTokens ?? []).map((t, i) => (
                  <Link
                    key={t.address}
                    to={paths.token(t.address)}
                    className="flex items-center gap-2 text-[11px]"
                  >
                    <span className="w-3 text-ink-400">{i + 1}</span>
                    <TokenIcon address={t.address} src={t.iconUrl} symbol={t.symbol} size={16} />
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-800">
                      {t.symbol}
                    </span>
                    <span className="text-right">
                      <span className="block font-medium text-ink-800">
                        {t.volume24h != null && t.volume24h > 0
                          ? usd(t.volume24h)
                          : compact(t.holders)}
                      </span>
                      {t.change24h != null && (
                        <span
                          className={`text-[10px] ${
                            (t.change24h ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {pct(t.change24h)}
                        </span>
                      )}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {wallets.loading && !wallets.data ? (
          <WidgetSkel title="Wallet Intelligence (24H)" />
        ) : (
          <div className="card p-2">
            <div className="panel-title mb-1.5">Wallet Intelligence (24H)</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div>
                <div className="text-[10px] text-ink-400">Whale Wallets</div>
                <div className="text-[13px] font-semibold text-ink-900">
                  {compact(wallets.data?.tracked ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ink-400">Smart Money Flow</div>
                <div className="text-[13px] font-semibold text-ink-900">
                  {usd(wallets.data?.totalValue ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ink-400">Active (24h)</div>
                <div className="font-semibold text-ink-900">
                  {compact(wallets.data?.active24h ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ink-400">Wallet Txns</div>
                <div className="font-semibold text-ink-900">
                  {compact(wallets.data?.txs24h ?? 0)}
                </div>
              </div>
            </div>
            <MiniSpark series={txSpark} color="#8b5cf6" />
            <Link
              to={paths.walletTracker}
              className="mt-1 inline-block text-[10px] font-medium text-arc-600"
            >
              Open Wallet Tracker →
            </Link>
          </div>
        )}

        {tokens.loading && !tokens.data ? (
          <TokenListSkel title="Token Flow (24H)" />
        ) : (
          <div className="card p-2">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="panel-title">Token Flow (24H)</div>
              <div className="flex gap-0.5">
                {(
                  [
                    ["in", "Inflows"],
                    ["out", "Outflows"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFlowTab(id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      flowTab === id ? "bg-violet-50 text-violet-700" : "text-ink-400"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {flowList.map((t) => (
                <Link
                  key={t.address}
                  to={paths.token(t.address)}
                  className="flex items-center gap-2 text-[11px]"
                >
                  <TokenIcon address={t.address} src={t.iconUrl} symbol={t.symbol} size={16} />
                  <span className="min-w-0 flex-1 truncate font-medium text-ink-800">
                    {t.symbol}
                  </span>
                  <span className={flowTab === "in" ? "text-emerald-600" : "text-rose-600"}>
                    {t.volume24h != null && t.volume24h > 0
                      ? usd(t.volume24h)
                      : pct(t.change24h ?? 0)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {tvlLoading ? (
          <DonutSkel title="Bridge Activity (24H)" />
        ) : (
          <div className="card p-2">
            <div className="panel-title mb-1">Bridge Activity (24H)</div>
            <DonutChart title="Bridge mix" slices={bridgeShare} colors={DONUT} bare />
          </div>
        )}

        {kpisLoading ? (
          <WidgetSkel title="ERC-8004 Agents (24H)" />
        ) : (
          <div className="card p-2">
            <div className="panel-title mb-1.5">ERC-8004 Agents (24H)</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div>
                <div className="text-[10px] text-ink-400">AA Wallets</div>
                <div className="text-[13px] font-semibold text-ink-900">
                  {compact(s?.aaWallets ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ink-400">User Ops</div>
                <div className="text-[13px] font-semibold text-ink-900">
                  {compact(s?.userOps ?? 0)}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-ink-400">Contracts</div>
                <div className="font-semibold text-ink-900">{compact(s?.totalContracts ?? 0)}</div>
              </div>
              <div>
                <div className="text-[10px] text-ink-400">TPS</div>
                <div className="font-semibold text-ink-900">{tps.toFixed(1)}</div>
              </div>
            </div>
            <MiniSpark series={addrSpark} color="#06b6d4" />
          </div>
        )}
      </div>
    </div>
  );
}
