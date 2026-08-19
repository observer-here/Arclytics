import { useMemo, useRef, useState } from "react";
import { usd } from "@/utils/format";

type Point = { date: string; value: number };
type Range = "1H" | "24H" | "7D" | "30D" | "90D" | "1Y" | "All";

const RANGES: Range[] = ["1H", "24H", "7D", "30D", "90D", "1Y", "All"];

function sliceRange(data: Point[], range: Range) {
  const n =
    range === "1H"
      ? 1
      : range === "24H"
        ? 2
        : range === "7D"
          ? 7
          : range === "30D"
            ? 30
            : range === "90D"
              ? 90
              : range === "1Y"
                ? 365
                : data.length;
  return data.slice(-Math.min(n, data.length));
}

function ChartRanges({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`rounded px-2 py-0.5 text-[10px] font-medium transition ${
            range === r
              ? "bg-arc-50 font-medium text-arc-700"
              : "text-ink-400 hover:bg-ink-50 hover:text-ink-700"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function ChartTip({ point, x, y }: { point: Point; x: number; y: number }) {
  return (
    <div
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-md border border-ink-200 bg-white px-2.5 py-1.5 shadow-sm"
      style={{ left: x, top: y }}
    >
      <div className="text-[10px] text-ink-400">{point.date}</div>
      <div className="text-[12px] font-semibold text-ink-900">{usd(point.value)}</div>
    </div>
  );
}

export function TokenPriceChart({ data, color = "#8b5cf6" }: { data: Point[]; color?: string }) {
  const [range, setRange] = useState<Range>("30D");
  const [tip, setTip] = useState<{ point: Point; x: number; y: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const sliced = useMemo(() => sliceRange(data, range), [data, range]);
  const values = sliced.map((d) => d.value);
  const max = Math.max(...values, 1e-9);
  const min = Math.min(...values.filter((v) => v > 0), max);
  const yMin = min > 0 && max / min < 50 ? min * 0.998 : 0;
  const yMax = max;
  const span = yMax - yMin || 1;
  const w = 900;
  const h = 320;
  const pad = 4;
  const pts = sliced.map((d, i) => {
    const x = pad + (i / Math.max(sliced.length - 1, 1)) * (w - pad * 2);
    const y = h - pad - ((d.value - yMin) / span) * (h - pad * 2);
    return [x, y] as const;
  });
  const line = pts.map(([x, y]) => `${x},${y}`).join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  const showAt = (i: number, clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !sliced[i]) return;
    const r = el.getBoundingClientRect();
    setTip({ point: sliced[i], x: clientX - r.left, y: Math.max(12, clientY - r.top - 8) });
  };

  const yTicks = [1, 0.5, 0].map((t) => ({ pct: t, label: usd(yMin + span * t) }));

  return (
    <div className="card flex min-h-[360px] flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-end border-b border-ink-100 px-3 py-2">
        <ChartRanges range={range} onChange={setRange} />
      </div>
      <div className="relative min-h-0 flex-1 px-1 pb-2">
        {!sliced.length ? (
          <div className="flex h-[300px] items-center justify-center text-xs text-ink-400">No price data</div>
        ) : (
          <div className="flex h-[300px]">
            <div className="relative w-12 shrink-0 text-right text-[9px] text-ink-400">
              {yTicks.map((t) => (
                <span
                  key={t.label}
                  className="absolute right-1 -translate-y-1/2"
                  style={{ top: `${(1 - t.pct) * 100}%` }}
                >
                  {t.label}
                </span>
              ))}
            </div>
            <div ref={box} className="relative min-w-0 flex-1" onMouseLeave={() => setTip(null)}>
              {tip && <ChartTip point={tip.point} x={tip.x} y={tip.y} />}
              <svg viewBox={`0 0 ${w} ${h}`} className="h-full w-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="tk-price-fill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity="0.35" />
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
                <polygon points={area} fill="url(#tk-price-fill)" />
                <polyline points={line} fill="none" stroke={color} strokeWidth="2.5" />
                {sliced.map((d, i) => {
                  const x0 = pad + ((i - 0.5) / Math.max(sliced.length - 1, 1)) * (w - pad * 2);
                  const x1 = pad + ((i + 0.5) / Math.max(sliced.length - 1, 1)) * (w - pad * 2);
                  return (
                    <rect
                      key={d.date}
                      x={Math.max(pad, x0)}
                      y={pad}
                      width={Math.max(8, x1 - x0)}
                      height={h - pad * 2}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={(e) => showAt(i, e.clientX, e.clientY)}
                      onMouseMove={(e) => showAt(i, e.clientX, e.clientY)}
                    />
                  );
                })}
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TokenMcapVolumeChart({
  mcap,
  volume,
}: {
  mcap: Point[];
  volume: Point[];
}) {
  const [range, setRange] = useState<Range>("All");
  const mSliced = useMemo(() => sliceRange(mcap, range), [mcap, range]);
  const vSliced = useMemo(() => sliceRange(volume, range), [volume, range]);
  const hasData = mSliced.some((d) => d.value > 0) || vSliced.some((d) => d.value > 0);
  const mMax = Math.max(...mSliced.map((d) => d.value), 1);
  const vMax = Math.max(...vSliced.map((d) => d.value), 1);
  const w = 900;
  const h = 200;
  const pad = 8;
  const n = Math.max(mSliced.length, vSliced.length, 1);
  const barW = (w - pad * 2) / n;

  const mLine = mSliced
    .map((d, i) => {
      const x = pad + (i / Math.max(mSliced.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - (d.value / mMax) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="panel-title">Market Cap &amp; Volume</span>
        <ChartRanges range={range} onChange={setRange} />
      </div>
      <div className="mb-2 flex gap-3 text-[10px]">
        <span className="flex items-center gap-1.5 text-ink-500">
          <span className="h-2 w-2 rounded-full bg-violet-500" /> Market Cap
        </span>
        <span className="flex items-center gap-1.5 text-ink-500">
          <span className="h-2 w-2 rounded-full bg-sky-500" /> Volume
        </span>
      </div>
      {!hasData ? (
        <div className="flex h-[180px] items-center justify-center px-4 text-center text-xs text-ink-400">
          No indexed history yet. High-volume tokens only show recent days until backfill completes.
        </div>
      ) : (
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[180px] w-full" preserveAspectRatio="none">
        {vSliced.map((d, i) => {
          const bh = (d.value / vMax) * (h - pad * 2) * 0.5;
          const x = pad + i * barW + barW * 0.15;
          return (
            <rect
              key={`v-${d.date}`}
              x={x}
              y={h - pad - bh}
              width={barW * 0.7}
              height={bh}
              fill="#0ea5e9"
              opacity="0.45"
              rx="1"
            />
          );
        })}
        <polyline points={mLine} fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
      </svg>
      )}
    </div>
  );
}

export function TokenDistributionChart({
  slices,
  center,
}: {
  slices: Array<{ label: string; value: number }>;
  center: string;
}) {
  const colors = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#3b82f6"];
  const total = slices.reduce((s, d) => s + d.value, 0) || 1;
  const r = 48;
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
    <div className="card p-3">
      <div className="panel-title mb-2">Token Distribution</div>
      {!slices.length ? (
        <div className="flex h-[160px] items-center justify-center text-xs text-ink-400">No data</div>
      ) : (
        <div className="flex items-center gap-4">
          <svg width="120" height="120" viewBox="0 0 120 120" className="shrink-0">
            <g transform="translate(60,60) rotate(-90)">
              <circle r={r} fill="none" stroke="#f1f5f9" strokeWidth="14" />
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
            <text x="60" y="56" textAnchor="middle" fill="#0f172a" fontSize="11" fontWeight="600">
              {center}
            </text>
            <text x="60" y="70" textAnchor="middle" fill="#94a3b8" fontSize="9">
              Total Supply
            </text>
          </svg>
          <div className="min-w-0 flex-1 space-y-1.5">
            {arcs.map((a) => (
              <div key={a.label} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex min-w-0 items-center gap-1.5 text-ink-500">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: a.color }} />
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
