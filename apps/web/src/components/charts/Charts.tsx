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
    const n = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : data.length;
    return data.slice(-n);
  }, [data, range]);
}

function ChartHeader({
  title,
  sliced,
  range,
  onRange,
}: {
  title: string;
  sliced: Point[];
  range: Range;
  onRange: (r: Range) => void;
}) {
  const latest = sliced.length ? sliced[sliced.length - 1].value : 0;
  const prev = sliced.length > 1 ? sliced[sliced.length - 2].value : latest;
  const delta = prev ? ((latest - prev) / prev) * 100 : 0;
  const total = sliced.reduce((s, d) => s + d.value, 0);
  const up = delta >= 0;

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
        <span className={`text-[11px] font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
          {up ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
        <span className="text-[11px] text-ink-400">sum {compact(total)}</span>
      </div>
    </div>
  );
}

function YAxis({ max, h }: { max: number; h: number }) {
  const ticks = [1, 0.5, 0].map((t) => ({
    y: h - 4 - t * (h - 8),
    label: compact(max * t),
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
  const max = Math.max(...sliced.map((d) => d.value), 1);
  const w = 520;
  const h = 110;
  const pad = 4;
  const pts = sliced.map((d, i) => {
    const x = pad + (i / Math.max(sliced.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - (d.value / max) * (h - pad * 2);
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
      <ChartHeader title={title} sliced={sliced} range={range} onRange={setRange} />
      {!sliced.length ? (
        <div className="flex h-[110px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex gap-1">
          <YAxis max={max} h={h} />
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
