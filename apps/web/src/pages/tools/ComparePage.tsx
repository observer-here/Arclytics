import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import { ChartSkel, Skel } from "@/components/shared/Skel";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useProgressiveMap } from "@/hooks/useProgressiveMap";
import type { ProtocolDetail, ProtocolRanking } from "@/libs/api";
import { loadCompareProtocolDetail } from "@/libs/compare";
import { loadDashRankings } from "@/libs/dashboard";
import { DASH } from "@/libs/prefetch";
import { paths } from "@/routes/paths";
import { compact, pct, usd } from "@/utils/format";
import { TokenCompare } from "./TokenCompare";
import { WalletCompare } from "./WalletCompare";

const TABS = ["Protocols", "Tokens", "Wallets"] as const;
const CHART_RANGES = ["7D", "30D", "90D", "1Y"] as const;
const COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#f59e0b"];
const MAX = 4;
const RANGE = "30D";

type Tab = (typeof TABS)[number];
type ChartRange = (typeof CHART_RANGES)[number];
type Point = { date: string; value: number };

function slicePts(data: Point[], range: ChartRange) {
  const n = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  const sliced = data.slice(-Math.min(n, data.length));
  const first = sliced.findIndex((d) => d.value > 0);
  return first > 0 && first < sliced.length - 1 ? sliced.slice(first) : sliced;
}

function sparkToPoints(spark: number[], endDate?: string): Point[] {
  if (!spark.length) return [];
  const end = endDate ? new Date(`${endDate}T00:00:00Z`) : new Date();
  return spark.map((value, i) => {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - (spark.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), value };
  });
}

function feeSeriesFrom(d: ProtocolDetail | null | undefined, vol: Point[]): Point[] {
  if (!vol.length) return sparkToPoints(d?.feeSpark ?? []);
  const bps = d?.protocol?.feeBps;
  const rate =
    bps != null && bps > 0
      ? bps / 10_000
      : (d?.volume24h ?? 0) > 0
        ? (d?.fees24h ?? 0) / (d?.volume24h ?? 1)
        : 0;
  if (rate > 0) return vol.map((p) => ({ date: p.date, value: p.value * rate }));
  return sparkToPoints(d?.feeSpark ?? [], vol[vol.length - 1]?.date);
}

function catLabel(c: string) {
  return CATEGORY_LABELS[c as ProtocolCategoryFilter] ?? c;
}

function winnerIdx(values: number[]) {
  if (!values.length || values.every((v) => !Number.isFinite(v))) return -1;
  let best = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}

function CompareLine({
  title,
  series,
  format = compact,
  loading = false,
}: {
  title: string;
  series: Array<{ label: string; color: string; data: Point[] }>;
  format?: (n: number) => string;
  loading?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ChartRange>("30D");
  const [tip, setTip] = useState<{
    i: number;
    x: number;
    y: number;
  } | null>(null);

  if (loading) return <ChartSkel title={title} kind="area" />;

  const sliced = series.map((s) => ({ ...s, data: slicePts(s.data, range) }));
  const dates = (() => {
    const set = new Set<string>();
    for (const s of sliced) for (const d of s.data) set.add(d.date);
    return [...set].sort();
  })();
  const aligned = sliced.map((s) => {
    const map = new Map(s.data.map((d) => [d.date, d.value]));
    return {
      ...s,
      data: dates.map((date) => ({ date, value: map.get(date) ?? 0 })),
    };
  });
  const max = Math.max(...aligned.flatMap((s) => s.data.map((d) => d.value)), 1);
  const w = 360;
  const h = 118;
  const padL = 42;
  const padR = 40;
  const padT = 8;
  const padB = 16;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const n = Math.max(dates.length - 1, 1);
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const xLabels =
    dates.length <= 6
      ? dates.map((d, i) => ({ i, label: d.slice(5) }))
      : [0, 0.5, 1].map((t) => {
          const i = Math.round(t * (dates.length - 1));
          return { i, label: dates[i]?.slice(5) ?? "" };
        });

  const showAt = (i: number, clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !dates[i]) return;
    const r = el.getBoundingClientRect();
    setTip({
      i,
      x: Math.min(r.width - 8, Math.max(8, clientX - r.left)),
      y: Math.max(12, clientY - r.top - 4),
    });
  };

  const hasData = dates.length >= 2;

  return (
    <div ref={box} className="card relative p-2" onMouseLeave={() => setTip(null)}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <div className="panel-title">{title}</div>
        <div className="flex rounded border border-ink-200 bg-white p-0.5">
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                range === r ? "bg-violet-600 text-white" : "text-ink-400"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {tip && dates[tip.i] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] shadow-sm"
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="font-medium text-ink-700">{dates[tip.i]}</div>
          <div className="mt-0.5 space-y-0.5">
            {aligned.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 text-ink-600">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                <span className="truncate">{s.label}</span>
                <span className="ml-auto font-medium text-ink-800">
                  {format(s.data[tip.i]?.value ?? 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!hasData ? (
        <div className="flex h-[100px] items-center justify-center text-[11px] text-ink-400">
          No series data
        </div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[110px] w-full overflow-visible" preserveAspectRatio="none">
          {yTicks.map((t) => {
            const y = padT + ih - t * ih;
            return (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
                <text
                  x={padL - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-ink-400"
                  fontSize="8"
                >
                  {format(max * t)}
                </text>
              </g>
            );
          })}
          {tip && (
            <line
              x1={padL + (tip.i / n) * iw}
              x2={padL + (tip.i / n) * iw}
              y1={padT}
              y2={padT + ih}
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
          )}
          {aligned.map((s) => {
            const line = s.data
              .map((d, i) => {
                const x = padL + (i / n) * iw;
                const y = padT + ih - (d.value / max) * ih;
                return `${x},${y}`;
              })
              .join(" ");
            const last = s.data[s.data.length - 1];
            const lx = padL + iw;
            const ly = padT + ih - (last.value / max) * ih;
            const bw = Math.max(28, format(last.value).length * 4.2 + 8);
            return (
              <g key={s.label}>
                <polyline points={line} fill="none" stroke={s.color} strokeWidth="2" />
                <circle cx={lx} cy={ly} r="2.5" fill={s.color} />
                <rect x={lx + 3} y={ly - 7} width={bw} height={12} rx="3" fill={s.color} />
                <text
                  x={lx + 3 + bw / 2}
                  y={ly + 2}
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="7"
                  fontWeight="600"
                >
                  {format(last.value)}
                </text>
              </g>
            );
          })}
          {xLabels.map(({ i, label }) => (
            <text
              key={`x-${i}`}
              x={padL + (i / n) * iw}
              y={h - 3}
              textAnchor="middle"
              className="fill-ink-400"
              fontSize="8"
            >
              {label}
            </text>
          ))}
          {dates.map((d, i) => {
            const x0 = padL + ((i - 0.5) / n) * iw;
            const x1 = padL + ((i + 0.5) / n) * iw;
            return (
              <rect
                key={`hit-${d}`}
                x={Math.max(padL, x0)}
                y={padT}
                width={Math.max(4, x1 - x0)}
                height={ih}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={(e) => showAt(i, e.clientX, e.clientY)}
                onMouseMove={(e) => showAt(i, e.clientX, e.clientY)}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

function MarketShareChart({
  series,
  loading = false,
}: {
  series: Array<{ label: string; color: string; data: Point[] }>;
  loading?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ChartRange>("30D");
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);

  if (loading) return <ChartSkel title="Market Share" kind="area" />;

  const sliced = series.map((s) => ({ ...s, data: slicePts(s.data, range) }));
  const dates = (() => {
    const set = new Set<string>();
    for (const s of sliced) for (const d of s.data) set.add(d.date);
    return [...set].sort();
  })();
  const aligned = sliced.map((s) => {
    const map = new Map(s.data.map((d) => [d.date, d.value]));
    return { ...s, data: dates.map((date) => ({ date, value: map.get(date) ?? 0 })) };
  });
  const stacked = dates.map((_, i) => {
    const vals = aligned.map((s) => s.data[i]?.value ?? 0);
    const sum = vals.reduce((a, b) => a + b, 0) || 1;
    return vals.map((v) => (v / sum) * 100);
  });
  const w = 360;
  const h = 118;
  const padL = 36;
  const padR = 8;
  const padT = 8;
  const padB = 16;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const n = Math.max(dates.length - 1, 1);
  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  const showAt = (i: number, clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !dates[i]) return;
    const r = el.getBoundingClientRect();
    setTip({
      i,
      x: Math.min(r.width - 8, Math.max(8, clientX - r.left)),
      y: Math.max(12, clientY - r.top - 4),
    });
  };

  return (
    <div ref={box} className="card relative p-2" onMouseLeave={() => setTip(null)}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <div className="panel-title">Market Share</div>
        <div className="flex rounded border border-ink-200 bg-white p-0.5">
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                range === r ? "bg-violet-600 text-white" : "text-ink-400"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {tip && dates[tip.i] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] shadow-sm"
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="font-medium text-ink-700">{dates[tip.i]}</div>
          <div className="mt-0.5 space-y-0.5">
            {aligned.map((s, si) => (
              <div key={s.label} className="flex items-center gap-1.5 text-ink-600">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                <span className="truncate">{s.label}</span>
                <span className="ml-auto font-medium text-ink-800">
                  {(stacked[tip.i]?.[si] ?? 0).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {!dates.length ? (
        <div className="flex h-[100px] items-center justify-center text-[11px] text-ink-400">
          No series data
        </div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[110px] w-full overflow-visible" preserveAspectRatio="none">
          {yTicks.map((t) => {
            const y = padT + ih - t * ih;
            return (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
                <text
                  x={padL - 4}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-ink-400"
                  fontSize="8"
                >
                  {Math.round(t * 100)}%
                </text>
              </g>
            );
          })}
          {aligned.map((s, si) => {
            const top = stacked
              .map((row, i) => {
                const above = row.slice(0, si).reduce((a, b) => a + b, 0);
                const x = padL + (i / n) * iw;
                const y = padT + ih - ((above + row[si]) / 100) * ih;
                return `${x},${y}`;
              })
              .join(" ");
            const bottom = stacked
              .map((row, i) => {
                const above = row.slice(0, si).reduce((a, b) => a + b, 0);
                const x = padL + (i / n) * iw;
                const y = padT + ih - (above / 100) * ih;
                return `${x},${y}`;
              })
              .reverse()
              .join(" ");
            return (
              <polygon
                key={s.label}
                points={`${top} ${bottom}`}
                fill={s.color}
                fillOpacity="0.55"
              />
            );
          })}
          {[0, Math.floor(dates.length / 2), dates.length - 1].map((i) =>
            dates[i] ? (
              <text
                key={`x-${i}`}
                x={padL + (i / n) * iw}
                y={h - 3}
                textAnchor="middle"
                className="fill-ink-400"
                fontSize="8"
              >
                {dates[i].slice(5)}
              </text>
            ) : null,
          )}
          {dates.map((d, i) => {
            const x0 = padL + ((i - 0.5) / n) * iw;
            const x1 = padL + ((i + 0.5) / n) * iw;
            return (
              <rect
                key={`hit-${d}`}
                x={Math.max(padL, x0)}
                y={padT}
                width={Math.max(4, x1 - x0)}
                height={ih}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={(e) => showAt(i, e.clientX, e.clientY)}
                onMouseMove={(e) => showAt(i, e.clientX, e.clientY)}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

function SelectSkel() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      {[0, 1].map((i) => (
        <div key={i} className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-ink-100 px-2.5 py-2">
          <Skel className="h-6 w-6 rounded" />
          <div className="min-w-0 flex-1 space-y-1">
            <Skel className="h-3 w-20" />
            <Skel className="h-2.5 w-14" />
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricsSkel() {
  return (
    <div className="card overflow-hidden p-2">
      <div className="mb-2 flex gap-2">
        <Skel className="h-3 w-16" />
        <Skel className="h-3 w-16" />
        <Skel className="h-3 w-16" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex gap-2">
            <Skel className="h-3 w-24" />
            <Skel className="h-3 flex-1" />
            <Skel className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComparePage() {
  const { data: rankings, loading: listLoading } = useAsyncData(DASH.rankings, loadDashRankings);
  const [tab, setTab] = useState<Tab>("Protocols");
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!rankings?.length || selected.length) return;
    setSelected(rankings.slice(0, 2).map((r) => r.slug));
  }, [rankings, selected.length]);

  const {
    data: details,
    pending,
  } = useProgressiveMap(selected, loadCompareProtocolDetail);

  const items = useMemo(() => {
    if (!rankings) return [] as ProtocolRanking[];
    return selected
      .map((slug) => rankings.find((r) => r.slug === slug))
      .filter(Boolean) as ProtocolRanking[];
  }, [rankings, selected]);

  const available = useMemo(() => {
    if (!rankings) return [];
    return rankings.filter((r) => !selected.includes(r.slug));
  }, [rankings, selected]);

  const chartsBoot = listLoading && !items.length;

  const metrics = useMemo(() => {
    if (items.length < 1) return [];
    const rows: Array<{
      key: string;
      label: string;
      values: number[];
      format: (n: number) => string;
      higherWins?: boolean;
    }> = [
      {
        key: "tvl",
        label: "TVL",
        values: items.map((p) => details[p.slug]?.tvlUsd ?? p.tvlUsd),
        format: usd,
      },
      {
        key: "vol",
        label: "24H Volume",
        values: items.map((p) => details[p.slug]?.volume24h ?? p.volume24h),
        format: usd,
      },
      {
        key: "fees",
        label: "Fees (24H)",
        values: items.map((p) => details[p.slug]?.fees24h ?? p.fees24h ?? 0),
        format: usd,
      },
      {
        key: "users",
        label: "Users (24H)",
        values: items.map((p) => details[p.slug]?.activeUsers ?? p.activeUsers24h ?? 0),
        format: compact,
      },
      {
        key: "txs",
        label: "Transactions (24H)",
        values: items.map((p) => details[p.slug]?.totals.txs ?? p.txs),
        format: compact,
      },
      {
        key: "tvlCh",
        label: "TVL Change (30D)",
        values: items.map((p) => p.change1m ?? details[p.slug]?.change24h ?? p.change24h ?? 0),
        format: (n) => pct(n) ?? "—",
      },
      {
        key: "volCh",
        label: "Volume Change (30D)",
        values: items.map((p) => details[p.slug]?.changeVol ?? p.change24h ?? 0),
        format: (n) => pct(n) ?? "—",
      },
      {
        key: "feeCh",
        label: "Fees Change (30D)",
        values: items.map((p) => details[p.slug]?.changeFees ?? 0),
        format: (n) => pct(n) ?? "—",
      },
    ];
    return rows;
  }, [items, details]);

  const chartSeries = useMemo(() => {
    return items.map((p, i) => {
      const d = details[p.slug];
      const color = COLORS[i % COLORS.length];
      const tvl: Point[] =
        d?.tvlSeries?.length
          ? d.tvlSeries
          : sparkToPoints(d?.tvlSpark ?? p.spark7d ?? []);
      const vol: Point[] =
        d?.volSeries?.length ? d.volSeries : sparkToPoints(d?.volSpark ?? []);
      const fees = feeSeriesFrom(d, vol);
      const users: Point[] =
        d?.activity?.unique?.length
          ? d.activity.unique
          : sparkToPoints(d?.userSpark ?? []);
      const txRaw = d?.activity?.txs ?? [];
      const txSum = txRaw.reduce((s, x) => s + x.value, 0);
      const txs: Point[] =
        txSum > 0 ? txRaw : d?.activity?.transfers?.length ? d.activity.transfers : [];
      return { label: p.name, color, tvl, vol, fees, users, txs };
    });
  }, [items, details]);

  const growthRows = useMemo(() => {
    return [
      {
        label: "TVL Growth",
        values: items.map((p) => p.change1m ?? details[p.slug]?.change24h ?? p.change24h ?? 0),
      },
      {
        label: "Volume Growth",
        values: items.map((p) => details[p.slug]?.changeVol ?? p.change24h ?? 0),
      },
      {
        label: "User Growth",
        values: items.map((p) => details[p.slug]?.changeUsers ?? 0),
      },
      {
        label: "Fee Growth",
        values: items.map((p) => details[p.slug]?.changeFees ?? 0),
      },
    ];
  }, [items, details]);

  const efficiencyRows = useMemo(() => {
    return items.map((p) => {
      const d = details[p.slug];
      const tvl = (d?.tvlUsd ?? p.tvlUsd) || 1;
      const vol = d?.volume24h ?? p.volume24h;
      const fees = d?.fees24h ?? p.fees24h ?? 0;
      const users = d?.activeUsers ?? p.activeUsers24h ?? 1;
      const txs = d?.totals.txs ?? p.txs;
      return {
        name: p.name,
        feesTvl: (fees / tvl) * 100,
        volTvl: vol / tvl,
        txsUser: txs / Math.max(users, 1),
        feesUser: fees / Math.max(users, 1),
      };
    });
  }, [items, details]);

  const remove = (slug: string) => setSelected((s) => s.filter((x) => x !== slug));
  const add = (slug: string) => {
    setSelected((s) => (s.length >= MAX || s.includes(slug) ? s : [...s, slug]));
    setPickerOpen(false);
  };

  return (
    <div className="space-y-2">
      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-ink-100 pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium ${
              tab === t ? "bg-violet-600 text-white" : "text-ink-500 hover:bg-ink-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Tokens" ? (
        <TokenCompare />
      ) : tab === "Wallets" ? (
        <WalletCompare />
      ) : listLoading && !rankings?.length ? (
        <>
          <SelectSkel />
          <MetricsSkel />
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {["TVL", "Volume", "Fees", "Users", "Transactions", "Market Share"].map((t) => (
              <ChartSkel key={t} title={t} kind="area" />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {items.map((p, i) => (
              <div key={p.slug} className="flex min-w-0 items-center gap-2 sm:flex-1">
                {i > 0 && (
                  <div className="hidden h-7 w-7 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-50 text-[9px] font-bold text-ink-500 sm:grid">
                    VS
                  </div>
                )}
                <div
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-white px-2.5 py-2"
                  style={{ borderColor: `${COLORS[i % COLORS.length]}66` }}
                >
                  <ProtocolIcon slug={p.slug} name={p.name} category={p.category} size={22} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-semibold text-ink-900">{p.name}</div>
                    <div className="text-[10px] text-ink-400">{catLabel(p.category)}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(p.slug)}
                    className="text-[12px] text-ink-400 hover:text-ink-700"
                    aria-label={`Remove ${p.name}`}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            {items.length < MAX && (
              <div className="relative min-w-0 sm:min-w-[140px] sm:flex-1">
                <button
                  type="button"
                  onClick={() => setPickerOpen((o) => !o)}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-ink-300 bg-white px-2.5 py-2 text-left"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-50 text-ink-500">
                    +
                  </span>
                  <span>
                    <span className="block text-[12px] font-medium text-ink-700">Add to compare</span>
                    <span className="text-[10px] text-ink-400">Up to {MAX} items</span>
                  </span>
                </button>
                {pickerOpen && (
                  <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-ink-200 bg-white shadow-lg">
                    {available.slice(0, 40).map((p) => (
                      <button
                        key={p.slug}
                        type="button"
                        onClick={() => add(p.slug)}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] hover:bg-ink-50"
                      >
                        <ProtocolIcon slug={p.slug} name={p.name} category={p.category} size={16} />
                        <span className="min-w-0 flex-1 truncate font-medium text-ink-800">
                          {p.name}
                        </span>
                        <span className="text-ink-400">{catLabel(p.category)}</span>
                      </button>
                    ))}
                    {!available.length && (
                      <div className="px-2.5 py-2 text-[11px] text-ink-400">No more protocols</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {!items.length ? (
            listLoading ? <MetricsSkel /> : null
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                      <th className="px-2 py-1.5 font-medium">Metric</th>
                      {items.map((p, i) => (
                        <th key={p.slug} className="px-2 py-1.5 font-medium">
                          <span className="inline-flex items-center gap-1">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ background: COLORS[i % COLORS.length] }}
                            />
                            {p.name}
                          </span>
                        </th>
                      ))}
                      {items.length === 2 && (
                        <th className="px-2 py-1.5 font-medium">Difference</th>
                      )}
                      {items.length >= 2 && (
                        <th className="px-2 py-1.5 font-medium">Winner</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m, ri) => {
                      const w = winnerIdx(m.values);
                      const diff =
                        items.length === 2 && m.values[0] != null && m.values[1] != null
                          ? m.values[0] - m.values[1]
                          : null;
                      return (
                        <tr
                          key={m.key}
                          className={`border-b border-ink-50 ${ri % 2 ? "bg-ink-50/40" : ""}`}
                        >
                          <td className="px-2 py-1.5 text-ink-500">{m.label}</td>
                          {m.values.map((v, i) => (
                            <td key={i} className="px-2 py-1.5 font-medium text-ink-800">
                              {m.format(v)}
                            </td>
                          ))}
                          {items.length === 2 && (
                            <td className="px-2 py-1.5 text-ink-600">
                              {diff == null
                                ? "—"
                                : m.key.includes("Ch")
                                  ? pct(diff)
                                  : m.format(Math.abs(diff))}
                            </td>
                          )}
                          {items.length >= 2 && (
                            <td className="px-2 py-1.5">
                              {w >= 0 ? (
                                <span
                                  className="rounded-full px-1.5 py-0.5 text-[9px] font-medium text-white"
                                  style={{ background: COLORS[w % COLORS.length] }}
                                >
                                  {items[w].name}
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <CompareLine
              title="TVL"
              format={usd}
              loading={chartsBoot}
              series={chartSeries.map((s) => ({
                label: s.label,
                color: s.color,
                data: s.tvl,
              }))}
            />
            <CompareLine
              title="Volume"
              format={usd}
              loading={chartsBoot}
              series={chartSeries.map((s) => ({
                label: s.label,
                color: s.color,
                data: s.vol,
              }))}
            />
            <CompareLine
              title="Fees"
              format={usd}
              loading={chartsBoot}
              series={chartSeries.map((s) => ({
                label: s.label,
                color: s.color,
                data: s.fees,
              }))}
            />
            <CompareLine
              title="Users"
              loading={chartsBoot}
              series={chartSeries.map((s) => ({
                label: s.label,
                color: s.color,
                data: s.users,
              }))}
            />
            <CompareLine
              title="Transactions"
              loading={chartsBoot}
              series={chartSeries.map((s) => ({
                label: s.label,
                color: s.color,
                data: s.txs,
              }))}
            />
            <MarketShareChart
              loading={chartsBoot}
              series={chartSeries.map((s) => ({
                label: s.label,
                color: s.color,
                data: s.tvl,
              }))}
            />
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            <div className="card p-2">
              <div className="panel-title mb-1.5">Growth Comparison ({RANGE})</div>
              {chartsBoot ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skel key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[10px] text-ink-400">
                      <th className="py-1 text-left font-medium">Metric</th>
                      {items.map((p) => (
                        <th key={p.slug} className="py-1 text-right font-medium">
                          {p.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {growthRows.map((r) => (
                      <tr key={r.label} className="border-t border-ink-50">
                        <td className="py-1 text-ink-500">{r.label}</td>
                        {r.values.map((v, i) => (
                          <td
                            key={i}
                            className={`py-1 text-right font-medium ${
                              v >= 0 ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {pct(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card p-2">
              <div className="panel-title mb-1.5">Efficiency Metrics ({RANGE})</div>
              {chartsBoot ? (
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skel key={i} className="h-4 w-full" />
                  ))}
                </div>
              ) : (
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-[10px] text-ink-400">
                      <th className="py-1 text-left font-medium">Metric</th>
                      {efficiencyRows.map((r) => (
                        <th key={r.name} className="py-1 text-right font-medium">
                          {r.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(
                      [
                        ["Fees / TVL", (r: (typeof efficiencyRows)[0]) => pct(r.feesTvl)],
                        ["Volume / TVL", (r: (typeof efficiencyRows)[0]) => r.volTvl.toFixed(2) + "x"],
                        ["Txns / User", (r: (typeof efficiencyRows)[0]) => compact(r.txsUser)],
                        ["Fees / User", (r: (typeof efficiencyRows)[0]) => usd(r.feesUser)],
                      ] as const
                    ).map(([label, fmt]) => (
                      <tr key={label} className="border-t border-ink-50">
                        <td className="py-1 text-ink-500">{label}</td>
                        {efficiencyRows.map((r) => (
                          <td key={r.name} className="py-1 text-right font-medium text-ink-800">
                            {fmt(r)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card p-2">
              <div className="panel-title mb-1.5">Protocol Overview</div>
              <div className="space-y-2">
                {items.map((p, i) => {
                  const d = details[p.slug];
                  const waiting = pending[p.slug] || !(p.slug in details);
                  return (
                    <div
                      key={p.slug}
                      className="rounded-lg border border-ink-100 p-2"
                      style={{ borderLeftWidth: 3, borderLeftColor: COLORS[i % COLORS.length] }}
                    >
                      <div className="mb-0.5 flex items-center gap-1.5 text-[12px] font-semibold text-ink-900">
                        <ProtocolIcon slug={p.slug} name={p.name} category={p.category} size={16} />
                        {p.name}
                      </div>
                      {waiting ? (
                        <div className="space-y-1">
                          <Skel className="h-2.5 w-full" />
                          <Skel className="h-2.5 w-4/5" />
                        </div>
                      ) : (
                        <>
                          <p className="text-[10px] leading-snug text-ink-500">
                            {d?.protocol.description ||
                              `${p.name} is a ${catLabel(p.category)} protocol on Arc Testnet.`}
                          </p>
                          <Link
                            to={paths.protocol(p.slug)}
                            className="mt-1 inline-block text-[10px] font-medium text-arc-600"
                          >
                            View Protocol →
                          </Link>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
