import { useMemo, useRef, useState } from "react";
import { compact, num } from "@/utils/format";

type Range = "7D" | "30D" | "90D" | "1Y" | "All";
type Point = { date: string; value: number };

const RANGES: Range[] = ["7D", "30D", "90D", "1Y", "All"];
const RANGE_STORE = "arclytics.chartRange";

function loadRange(id: string): Range {
  try {
    const all = JSON.parse(localStorage.getItem(RANGE_STORE) || "{}") as Record<string, string>;
    const v = all[id];
    if (RANGES.includes(v as Range)) return v as Range;
  } catch {
    /* ignore */
  }
  return "7D";
}

function saveRange(id: string, range: Range) {
  try {
    const all = JSON.parse(localStorage.getItem(RANGE_STORE) || "{}") as Record<string, Range>;
    all[id] = range;
    localStorage.setItem(RANGE_STORE, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function useChartRange(id: string) {
  const [range, setRange] = useState<Range>(() => loadRange(id));
  return [
    range,
    (next: Range) => {
      setRange(next);
      saveRange(id, next);
    },
  ] as const;
}

function RangeButtons({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`rounded px-1.5 py-0.5 text-[10px] ${
            range === r ? "bg-arc-50 font-medium text-arc-700" : "text-ink-400 hover:text-ink-700"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function plotIndex(el: HTMLElement, n: number, clientX: number, bars?: boolean) {
  const t = (clientX - el.getBoundingClientRect().left) / Math.max(el.clientWidth, 1);
  if (bars) return Math.max(0, Math.min(n - 1, Math.floor(t * n)));
  return Math.max(0, Math.min(n - 1, Math.round(t * Math.max(n - 1, 1))));
}

function tipPos(el: HTMLElement, clientX: number, clientY: number) {
  const r = el.getBoundingClientRect();
  return {
    x: Math.min(r.width - 24, Math.max(24, clientX - r.left)),
    y: Math.max(16, Math.min(r.height - 8, clientY - r.top - 8)),
  };
}

function useRangeData(data: Point[], range: Range) {
  return useMemo(() => {
    const n =
      range === "7D"
        ? 7
        : range === "30D"
          ? 30
          : range === "90D"
            ? 90
            : range === "1Y"
              ? 365
              : data.length;
    return data.slice(-Math.min(n, data.length));
  }, [data, range]);
}

function ChartHeader({
  title,
  sliced,
  range,
  onRange,
  mode = "flow",
}: {
  title: string;
  sliced: Point[];
  range: Range;
  onRange: (r: Range) => void;
  mode?: "stock" | "flow";
}) {
  const latest = sliced.length ? sliced[sliced.length - 1].value : 0;
  const firstIdx = sliced.findIndex((d) => d.value > 0);
  const first = firstIdx >= 0 ? sliced[firstIdx].value : 0;
  const delta = first > 0 ? ((latest - first) / first) * 100 : 0;
  const total = sliced.reduce((s, d) => s + d.value, 0);
  const up = delta >= 0;
  const hasRange = firstIdx >= 0 && firstIdx < sliced.length - 1;

  return (
    <div className="mb-1.5 min-w-0 space-y-1">
      <div className="flex min-w-0 items-center justify-between gap-1">
        <div className="panel-title min-w-0 truncate">{title}</div>
        <RangeButtons range={range} onChange={onRange} />
      </div>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <div className="text-lg font-semibold tracking-tight text-ink-900">
          {compact(latest)}
        </div>
        {hasRange && (
          <span className={`text-[11px] font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
            {up ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
        {mode === "flow" && total > 0 && (
          <span className="text-[11px] text-ink-400">sum {compact(total)}</span>
        )}
      </div>
    </div>
  );
}

function YAxis({
  max,
  min = 0,
  h,
}: {
  max: number;
  min?: number;
  h: number;
}) {
  const span = max - min || 1;
  const ticks = [1, 0.5, 0].map((t) => ({
    y: h - 4 - t * (h - 8),
    label: compact(min + span * t),
  }));
  return (
    <div
      className="relative w-9 shrink-0 overflow-hidden text-right text-[9px] leading-none text-ink-400"
      style={{ height: h }}
    >
      {ticks.map((t) => (
        <span
          key={t.label + t.y}
          className="absolute right-0 -translate-y-1/2"
          style={{ top: t.y }}
        >
          {t.label}
        </span>
      ))}
    </div>
  );
}

function Tip({
  point,
  x,
  y,
}: {
  point: Point;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-[70%] -translate-x-1/2 -translate-y-full rounded-md border border-ink-200 bg-white px-2 py-1 shadow-sm"
      style={{ left: x, top: y }}
    >
      <div className="text-[10px] text-ink-400">{point.date}</div>
      <div className="text-[12px] font-semibold text-ink-900">{num(point.value)}</div>
    </div>
  );
}

export function AreaChartCard({
  title,
  data,
  color = "#2563eb",
  mode = "stock",
}: {
  title: string;
  data: Point[];
  color?: string;
  mode?: "stock" | "flow";
}) {
  const [range, onRange] = useChartRange(title);
  const [tip, setTip] = useState<{ point: Point; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const sliced = useRangeData(data, range);
  const values = sliced.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values.filter((v) => v > 0), max);
  const yMin = min > 0 && max / min < 50 ? min * 0.998 : 0;
  const yMax = max;
  const span = yMax - yMin || 1;
  const w = 520;
  const h = 110;
  const pad = 4;
  const pts = sliced.map((d, i) => {
    const x = pad + (i / Math.max(sliced.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((d.value - yMin) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;
  const gradId = `fill-${title.replace(/\W+/g, "-")}`;

  const showAt = (clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !sliced.length) return;
    const i = plotIndex(el, sliced.length, clientX);
    setTip({ point: sliced[i], ...tipPos(el, clientX, clientY) });
  };

  return (
    <div className="card min-w-0 overflow-hidden p-2.5">
      <ChartHeader title={title} sliced={sliced} range={range} onRange={onRange} mode={mode} />
      {!sliced.length ? (
        <div className="flex h-[110px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex min-w-0 gap-1">
          <YAxis max={yMax} min={yMin} h={h} />
          <div
            ref={box}
            className="relative min-w-0 flex-1 touch-pan-y"
            onPointerLeave={() => setTip(null)}
            onPointerMove={(e) => showAt(e.clientX, e.clientY)}
            onPointerDown={(e) => showAt(e.clientX, e.clientY)}
          >
            {tip && <Tip point={tip.point} x={tip.x} y={tip.y} />}
            <svg viewBox={`0 0 ${w} ${h}`} className="h-[110px] w-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {[0.25, 0.5, 0.75].map((t) => (
                <line
                  key={t}
                  x1={pad}
                  x2={w - pad}
                  y1={h - pad - t * (h - pad * 2)}
                  y2={h - pad - t * (h - pad * 2)}
                  stroke="var(--chart-grid)"
                  strokeWidth="1"
                />
              ))}
              <polygon points={area} fill={`url(#${gradId})`} />
              <polyline points={line} fill="none" stroke={color} strokeWidth="2" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export function DonutChart({
  title,
  slices,
  colors = ["#3b82f6", "#8b5cf6", "#f97316", "#10b981", "#06b6d4"],
  bare,
}: {
  title: string;
  slices: Array<{ label: string; value: number }>;
  colors?: string[];
  bare?: boolean;
}) {
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const arcs = slices.map((s, i) => {
    const len = (s.value / total) * c;
    const dash = `${len} ${c - len}`;
    const o = offset;
    offset += len;
    return { ...s, dash, o, color: colors[i % colors.length], pct: (s.value / total) * 100 };
  });

  return (
    <div className={bare ? undefined : "card p-2.5"}>
      {!bare && <div className="panel-title mb-2">{title}</div>}
      {!slices.length ? (
        <div className="flex h-[100px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex items-center gap-2">
          <svg width={bare ? 88 : 110} height={bare ? 88 : 110} viewBox="0 0 110 110" className="shrink-0">
            <g transform="translate(55,55) rotate(-90)">
              {arcs.map((a) => (
                <circle
                  key={a.label}
                  r={r}
                  fill="none"
                  stroke={a.color}
                  strokeWidth="14"
                  strokeDasharray={a.dash}
                  strokeDashoffset={-a.o}
                />
              ))}
            </g>
            <text x="55" y="52" textAnchor="middle" className="fill-ink-400 text-[9px]">
              Total
            </text>
            <text x="55" y="66" textAnchor="middle" className="fill-ink-900 text-[11px] font-semibold">
              {compact(total)}
            </text>
          </svg>
          <div className="min-w-0 flex-1 space-y-1">
            {arcs.map((a) => (
              <div key={a.label} className="flex items-center justify-between gap-1.5 text-[10px]">
                <span className="flex min-w-0 items-center gap-1 text-ink-600">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: a.color }} />
                  <span className="truncate">{a.label}</span>
                </span>
                <span className="shrink-0 font-medium text-ink-800">{a.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function MultiLineChart({
  title,
  series,
}: {
  title: string;
  series: Array<{ label: string; color: string; data: Point[] }>;
}) {
  const [range, onRange] = useChartRange(title);
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const n =
    range === "7D"
      ? 7
      : range === "30D"
        ? 30
        : range === "90D"
          ? 90
          : range === "1Y"
            ? 365
            : Number.POSITIVE_INFINITY;
  const sliced = series.map((s) => ({
    ...s,
    data: n === Number.POSITIVE_INFINITY ? s.data : s.data.slice(-Math.min(n, s.data.length)),
  }));
  const len = Math.max(...sliced.map((s) => s.data.length), 0);
  const max = Math.max(...sliced.flatMap((s) => s.data.map((d) => d.value)), 1);
  const w = 520;
  const h = 120;
  const pad = 4;
  const xAt = (i: number) => pad + (i / Math.max(len - 1, 1)) * (w - pad * 2);
  const yAt = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const showAt = (clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !len) return;
    setTip({ i: plotIndex(el, len, clientX), ...tipPos(el, clientX, clientY) });
  };

  return (
    <div className="card min-w-0 overflow-hidden p-2.5">
      <div className="mb-1.5 flex min-w-0 items-center justify-between gap-1">
        <div className="panel-title min-w-0 truncate">{title}</div>
        <RangeButtons range={range} onChange={onRange} />
      </div>
      <div className="mb-1.5 flex flex-wrap gap-2">
        {sliced.map((s) => (
          <span key={s.label} className="flex items-center gap-1 text-[10px] text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      {!len ? (
        <div className="flex h-[120px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex min-w-0 gap-1">
          <YAxis max={max} h={h} />
          <div
            ref={box}
            className="relative min-w-0 flex-1 cursor-crosshair touch-pan-y"
            onPointerLeave={() => setTip(null)}
            onPointerMove={(e) => showAt(e.clientX, e.clientY)}
            onPointerDown={(e) => showAt(e.clientX, e.clientY)}
          >
            {tip && (
              <div
                className="pointer-events-none absolute z-20 min-w-[8rem] -translate-x-1/2 -translate-y-full rounded-md border border-ink-200 bg-white px-2 py-1 shadow-sm dark:border-[var(--line)] dark:bg-[var(--surface-1)]"
                style={{ left: tip.x, top: tip.y }}
              >
                <div className="text-[10px] text-ink-400">{sliced[0]?.data[tip.i]?.date ?? ""}</div>
                {sliced.map((s) => (
                  <div key={s.label} className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-ink-500">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                      {s.label}
                    </span>
                    <span className="font-semibold text-ink-900">{num(s.data[tip.i]?.value ?? 0)}</span>
                  </div>
                ))}
              </div>
            )}
            <svg viewBox={`0 0 ${w} ${h}`} className="h-[120px] min-w-0 w-full" preserveAspectRatio="none">
              {[0.25, 0.5, 0.75].map((t) => (
                <line
                  key={t}
                  x1={pad}
                  x2={w - pad}
                  y1={h - pad - t * (h - pad * 2)}
                  y2={h - pad - t * (h - pad * 2)}
                  stroke="var(--chart-grid)"
                  strokeWidth="1"
                />
              ))}
              {sliced.map((s) => (
                <polyline
                  key={s.label}
                  points={s.data.map((d, i) => `${xAt(i)},${yAt(d.value)}`).join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                />
              ))}
              {tip && (
                <>
                  <line
                    x1={xAt(tip.i)}
                    x2={xAt(tip.i)}
                    y1={pad}
                    y2={h - pad}
                    stroke="var(--chart-grid)"
                    strokeWidth="1.5"
                  />
                  {sliced.map((s) => (
                    <circle
                      key={s.label}
                      cx={xAt(tip.i)}
                      cy={yAt(s.data[tip.i]?.value ?? 0)}
                      r="3.2"
                      fill={s.color}
                    />
                  ))}
                </>
              )}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

export function BarChartCard({
  title,
  data,
  color = "#8b5cf6",
}: {
  title: string;
  data: Point[];
  color?: string;
}) {
  const [range, onRange] = useChartRange(title);
  const [active, setActive] = useState<number | null>(null);
  const [tip, setTip] = useState<{ point: Point; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const sliced = useRangeData(data, range);
  const max = Math.max(...sliced.map((d) => d.value), 1);
  const w = 520;
  const h = 110;
  const pad = 4;
  const bw = sliced.length ? (w - pad * 2) / sliced.length : 0;

  const showAt = (clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !sliced.length) return;
    const i = plotIndex(el, sliced.length, clientX, true);
    setActive(i);
    setTip({ point: sliced[i], ...tipPos(el, clientX, clientY) });
  };

  return (
    <div className="card min-w-0 overflow-hidden p-2.5">
      <ChartHeader title={title} sliced={sliced} range={range} onRange={onRange} />
      {!sliced.length ? (
        <div className="flex h-[110px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex min-w-0 gap-1">
          <YAxis max={max} h={h} />
          <div
            ref={box}
            className="relative min-w-0 flex-1 touch-pan-y"
            onPointerLeave={() => {
              setActive(null);
              setTip(null);
            }}
            onPointerMove={(e) => showAt(e.clientX, e.clientY)}
            onPointerDown={(e) => showAt(e.clientX, e.clientY)}
          >
            {tip && <Tip point={tip.point} x={tip.x} y={tip.y} />}
            <svg viewBox={`0 0 ${w} ${h}`} className="h-[110px] w-full" preserveAspectRatio="none">
              {sliced.map((d, i) => {
                const bh = Math.max(2, (d.value / max) * (h - pad * 2));
                return (
                  <rect
                    key={d.date}
                    x={pad + i * bw}
                    y={h - pad - bh}
                    width={Math.max(0.4, bw * 0.85)}
                    height={bh}
                    rx="1"
                    fill={color}
                    opacity={active == null || active === i ? 0.95 : 0.35}
                  />
                );
              })}
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
