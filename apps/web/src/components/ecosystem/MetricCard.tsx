import type { ReactNode } from "react";

export function MetricCard({
  label,
  value,
  change,
  icon,
  series = [],
  color = "#2563eb",
  iconBg = "bg-arc-50 text-arc-600",
}: {
  label: string;
  value: string;
  change?: number;
  icon: ReactNode;
  series?: number[];
  color?: string;
  iconBg?: string;
}) {
  const max = Math.max(...series, 1);
  const positive = (change ?? 0) >= 0;
  const line = series
    .map((v, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * 100;
      const y = 28 - (v / max) * 22;
      return `${x},${y}`;
    })
    .join(" ");
  const area = series.length
    ? `0,30 ${line} 100,30`
    : "";

  return (
    <div className="card p-3">
      <div className={`mb-2 grid h-8 w-8 place-items-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="text-[11px] text-ink-500">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <div className="text-lg font-semibold tracking-tight text-ink-900">{value}</div>
        {change != null && (
          <span className={`text-[11px] font-medium ${positive ? "text-emerald-600" : "text-rose-600"}`}>
            {positive ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
      {series.length > 1 && (
        <svg className="mt-2 w-full" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
          <defs>
            <linearGradient id={`m-${label.replace(/\W+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={area} fill={`url(#m-${label.replace(/\W+/g, "")})`} />
          <polyline fill="none" stroke={color} strokeWidth="2" points={line} />
        </svg>
      )}
    </div>
  );
}
