import type { ReactNode } from "react";
import { Skel } from "@/components/shared/Skel";

export function MetricCard({
  label,
  value,
  change,
  icon,
  series = [],
  color = "#2563eb",
  loading = false,
  hasSpark = false,
}: {
  label: string;
  value: string;
  change?: number;
  icon: ReactNode;
  series?: number[];
  color?: string;
  loading?: boolean;
  hasSpark?: boolean;
}) {
  const max = Math.max(...series, 1);
  const positive = (change ?? 0) >= 0;
  const line = series
    .map((v, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * 100;
      const y = 12 - (v / max) * 9;
      return `${x},${y}`;
    })
    .join(" ");
  const area = series.length > 1 ? `0,14 ${line} 100,14` : "";
  const gid = `g-${label.replace(/\W+/g, "")}`;

  return (
    <div className="card-pad">
      <div className="mb-0.5 flex items-center justify-between gap-0.5">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-arc-50 text-arc-600">
          {icon}
        </span>
        {loading ? (
          <Skel className="h-2.5 w-8" />
        ) : change != null ? (
          <span className={`truncate text-[9px] font-medium ${positive ? "text-emerald-600" : "text-rose-600"}`}>
            {positive ? "▲" : "▼"} {Math.abs(change).toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="truncate text-[9px] leading-tight text-ink-500">{label}</div>
      {loading ? (
        <Skel className="mt-1 h-3 w-16" />
      ) : (
        <div className="mt-px truncate text-[12px] font-semibold leading-tight text-ink-900">{value}</div>
      )}
      {loading ? (
        hasSpark ? <Skel className="mt-1 h-[14px] w-full" /> : null
      ) : series.length > 1 ? (
        <svg className="mt-0.5 w-full" height="14" viewBox="0 0 100 14" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline fill="none" stroke={color} strokeWidth="1.6" points={line} />
        </svg>
      ) : null}
    </div>
  );
}
