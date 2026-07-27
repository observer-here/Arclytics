import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  change,
  icon,
  series = [],
  color = "#2563eb",
}: {
  label: string;
  value: string;
  change?: number;
  icon: ReactNode;
  series?: number[];
  color?: string;
}) {
  const max = Math.max(...series, 1);
  const positive = (change ?? 0) >= 0;
  const line = series
    .map((v, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * 100;
      const y = 16 - (v / max) * 12;
      return `${x},${y}`;
    })
    .join(" ");
  const area = series.length > 1 ? `0,18 ${line} 100,18` : "";
  const gid = `g-${label.replace(/\W+/g, "")}`;

  return (
    <div className="card-pad">
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-arc-50 text-arc-600">
          {icon}
        </span>
        {change != null && (
          <span className={positive ? "badge-up" : "badge-down"}>
            {positive ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
      <div className="text-[10px] leading-tight text-ink-500">{label}</div>
      <div className="mt-0.5 text-[15px] font-semibold leading-tight text-ink-900">{value}</div>
      {series.length > 1 && (
        <svg className="mt-1 w-full" height="18" viewBox="0 0 100 18" preserveAspectRatio="none">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#${gid})`} />
          <polyline fill="none" stroke={color} strokeWidth="1.8" points={line} />
        </svg>
      )}
    </div>
  );
}
