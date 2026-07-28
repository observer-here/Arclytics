import { useMemo, useRef, useState } from "react";
import { compact, num } from "@/utils/format";

type Range = "7D" | "30D" | "90D" | "1Y" | "All";
type Point = { date: string; value: number };

function RangeButtons({
  range,
  onChange,
}: {
  range: Range;
  onChange: (r: Range) => void;
}) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {(["7D", "30D", "90D", "1Y", "All"] as Range[]).map((r) => (
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
    <div className="mb-1.5 space-y-1">
      <div className="flex items-center justify-between gap-2">
        <div className="panel-title">{title}</div>
        <RangeButtons range={range} onChange={onRange} />
      </div>
      <div className="flex items-baseline gap-2">
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
      className="relative w-9 shrink-0 text-right text-[9px] leading-none text-ink-400"
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
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-ink-200 bg-white px-2 py-1 shadow-sm"
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
}: {
  title: string;
  data: Point[];
  color?: string;
}) {
  const [range, setRange] = useState<Range>("30D");
  const [tip, setTip] = useState<{ point: Point; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const sliced = useRangeData(data, range);
  const values = sliced.map((d) => d.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values.filter((v) => v > 0), max);
  // TVL stock charts: zoom to range so 7D/30D movement is visible
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

  const showAt = (i: number, clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !sliced[i]) return;
    const r = el.getBoundingClientRect();
    setTip({
      point: sliced[i],
      x: clientX - r.left,
      y: Math.max(12, clientY - r.top - 8),
    });
  };

  return (
    <div className="card p-2.5">
      <ChartHeader title={title} sliced={sliced} range={range} onRange={setRange} mode="stock" />
      {!sliced.length ? (
        <div className="flex h-[110px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex gap-1">
          <YAxis max={yMax} min={yMin} h={h} />
          <div
            ref={box}
            className="relative min-w-0 flex-1"
            onMouseLeave={() => setTip(null)}
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
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
              ))}
              <polygon points={area} fill={`url(#${gradId})`} />
              <polyline points={line} fill="none" stroke={color} strokeWidth="2" />
              {sliced.map((d, i) => {
                const x0 = pad + ((i - 0.5) / Math.max(sliced.length - 1, 1)) * (w - pad * 2);
                const x1 = pad + ((i + 0.5) / Math.max(sliced.length - 1, 1)) * (w - pad * 2);
                return (
                  <rect
                    key={`h-${d.date}`}
                    x={Math.max(pad, x0)}
                    y={pad}
                    width={Math.max(4, x1 - x0)}
                    height={h - pad * 2}
                    fill="transparent"
                    className="cursor-crosshair"
                    onMouseEnter={(e) => showAt(i, e.clientX, e.clientY)}
                    onMouseMove={(e) => showAt(i, e.clientX, e.clientY)}
                    onClick={(e) => showAt(i, e.clientX, e.clientY)}
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
      <div className="panel-title mb-2">{title}</div>
      {!slices.length ? (
        <div className="flex h-[140px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex items-center gap-3">
          <svg width="110" height="110" viewBox="0 0 110 110" className="shrink-0">
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
          <div className="min-w-0 flex-1 space-y-1.5">
            {arcs.map((a) => (
              <div key={a.label} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5 text-ink-600">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: a.color }} />
                  <span className="truncate">{a.label}</span>
                </span>
                <span className="shrink-0 font-medium text-ink-800">{a.pct.toFixed(1)}%</span>
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
  const [range, setRange] = useState<Range>("30D");
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
  const max = Math.max(...sliced.flatMap((s) => s.data.map((d) => d.value)), 1);
  const w = 520;
  const h = 120;
  const pad = 4;

  return (
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="panel-title">{title}</div>
        <RangeButtons range={range} onChange={setRange} />
      </div>
      <div className="mb-1.5 flex flex-wrap gap-2">
        {sliced.map((s) => (
          <span key={s.label} className="flex items-center gap-1 text-[10px] text-ink-500">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex gap-1">
        <YAxis max={max} h={h} />
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[120px] w-full" preserveAspectRatio="none">
          {[0.25, 0.5, 0.75].map((t) => (
            <line
              key={t}
              x1={pad}
              x2={w - pad}
              y1={h - pad - t * (h - pad * 2)}
              y2={h - pad - t * (h - pad * 2)}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
          ))}
          {sliced.map((s) => {
            const line = s.data
              .map((d, i) => {
                const x = pad + (i / Math.max(s.data.length - 1, 1)) * (w - pad * 2);
                const y = h - pad - (d.value / max) * (h - pad * 2);
                return `${x},${y}`;
              })
              .join(" ");
            return (
              <polyline key={s.label} points={line} fill="none" stroke={s.color} strokeWidth="2" />
            );
          })}
        </svg>
      </div>
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
  const [range, setRange] = useState<Range>("30D");
  const [active, setActive] = useState<number | null>(null);
  const [tip, setTip] = useState<{ point: Point; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const sliced = useRangeData(data, range);
  const max = Math.max(...sliced.map((d) => d.value), 1);
  const h = 110;

  const showAt = (i: number, clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !sliced[i]) return;
    const r = el.getBoundingClientRect();
    setActive(i);
    setTip({
      point: sliced[i],
      x: clientX - r.left,
      y: Math.max(12, clientY - r.top - 8),
    });
  };

  const clear = () => {
    setActive(null);
    setTip(null);
  };

  return (
    <div className="card p-2.5">
      <ChartHeader title={title} sliced={sliced} range={range} onRange={setRange} />
      {!sliced.length ? (
        <div className="flex h-[110px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex gap-1">
          <YAxis max={max} h={h} />
          <div
            ref={box}
            className="relative flex h-[110px] min-w-0 flex-1 items-end gap-px"
            onMouseLeave={clear}
          >
            {tip && <Tip point={tip.point} x={tip.x} y={tip.y} />}
            {sliced.map((d, i) => (
              <button
                key={d.date}
                type="button"
                aria-label={`${d.date}: ${num(d.value)}`}
                className="min-w-0 flex-1 rounded-t-[2px] transition"
                style={{
                  height: `${Math.max(3, (d.value / max) * 100)}%`,
                  background: color,
                  opacity: active == null || active === i ? 0.95 : 0.35,
                }}
                onMouseEnter={(e) => showAt(i, e.clientX, e.clientY)}
                onMouseMove={(e) => showAt(i, e.clientX, e.clientY)}
                onFocus={(e) => {
                  const r = e.currentTarget.getBoundingClientRect();
                  const boxR = box.current?.getBoundingClientRect();
                  if (!boxR) return;
                  setActive(i);
                  setTip({
                    point: d,
                    x: r.left - boxR.left + r.width / 2,
                    y: r.top - boxR.top,
                  });
                }}
                onBlur={clear}
                onClick={(e) => showAt(i, e.clientX, e.clientY)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
