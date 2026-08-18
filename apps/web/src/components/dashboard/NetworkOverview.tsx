import { usdc } from "@/utils/format";

export function NetworkOverview({
  byCategory,
  validators = 0,
  avgBlockTime,
  tps,
  avgFeeUsdc,
}: {
  byCategory: Record<string, number>;
  validators?: number;
  avgBlockTime?: number;
  tps?: number;
  avgFeeUsdc?: number;
}) {
  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0) || 1;
  const colors = ["#2563eb", "#6366f1", "#06b6d4", "#10b981", "#f59e0b"];

  return (
    <div className="card p-2.5">
      <div className="mb-1.5 panel-title">Network Overview</div>
      <div className="mb-2 grid place-items-center rounded-xl bg-gradient-to-br from-arc-50 to-indigo-50 p-3">
        <div className="relative grid h-28 w-28 place-items-center rounded-full border-[3px] border-white bg-white shadow-card">
          <div className="text-center">
            <div className="text-[10px] text-ink-400">Categories</div>
            <div className="text-base font-semibold text-ink-900">{entries.length}</div>
          </div>
          <svg className="absolute inset-0" viewBox="0 0 100 100">
            {(() => {
              let start = -Math.PI / 2;
              return entries.map(([label, value], i) => {
                const sweep = (value / total) * Math.PI * 2;
                const x1 = 50 + 42 * Math.cos(start);
                const y1 = 50 + 42 * Math.sin(start);
                const end = start + sweep;
                const x2 = 50 + 42 * Math.cos(end);
                const y2 = 50 + 42 * Math.sin(end);
                const large = sweep > Math.PI ? 1 : 0;
                const d = `M ${x1} ${y1} A 42 42 0 ${large} 1 ${x2} ${y2}`;
                start = end;
                return (
                  <path
                    key={label}
                    d={d}
                    fill="none"
                    stroke={colors[i % colors.length]}
                    strokeWidth="7"
                    strokeLinecap="round"
                  />
                );
              });
            })()}
          </svg>
        </div>
      </div>

      <div className="mb-2 space-y-1">
        {entries.map(([label, value], i) => (
          <div key={label} className="flex items-center justify-between text-[12px]">
            <span className="flex items-center gap-1.5 capitalize text-ink-600">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: colors[i % colors.length] }}
              />
              {label}
            </span>
            <span className="font-medium text-ink-800">{((value / total) * 100).toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-ink-50 p-1.5">
          <div className="text-[10px] text-ink-400">Validators</div>
          <div className="text-[12px] font-semibold">{validators || "—"}</div>
        </div>
        <div className="rounded-lg bg-ink-50 p-1.5">
          <div className="text-[10px] text-ink-400">Avg. Block</div>
          <div className="text-[12px] font-semibold">
            {avgBlockTime ? `${(avgBlockTime / 1000).toFixed(1)}s` : "—"}
          </div>
        </div>
        <div className="rounded-lg bg-ink-50 p-1.5">
          <div className="text-[10px] text-ink-400">Network TPS</div>
          <div className="text-[12px] font-semibold">{tps != null ? tps.toFixed(1) : "—"}</div>
        </div>
        <div className="rounded-lg bg-ink-50 p-1.5">
          <div className="text-[10px] text-ink-400">Avg Gas Fee</div>
          <div className="text-[12px] font-semibold">
            {avgFeeUsdc ? usdc(avgFeeUsdc) : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
