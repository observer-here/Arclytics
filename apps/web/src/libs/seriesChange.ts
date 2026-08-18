export type SeriesPoint = { date: string; value: number; approx?: boolean };

export function growthFromAdded(total: number, added24h: number): number | undefined {
  if (!Number.isFinite(total) || !Number.isFinite(added24h) || added24h < 0) return undefined;
  const base = total - added24h;
  if (base <= 0) return undefined;
  return (added24h / base) * 100;
}

export function lastCompleteValue(series: SeriesPoint[]): number | undefined {
  const pts = series.filter((p) => Number.isFinite(p.value));
  if (!pts.length) return undefined;
  const last = pts[pts.length - 1];
  if (last.approx && pts.length >= 2) return pts[pts.length - 2].value;
  return last.value;
}

export function weightedChange(
  rows: Array<{ tvlUsd: number; change24h?: number }>,
): number | undefined {
  let w = 0;
  let s = 0;
  for (const r of rows) {
    if (r.change24h == null || !r.tvlUsd) continue;
    w += r.tvlUsd;
    s += r.tvlUsd * r.change24h;
  }
  if (w <= 0) return undefined;
  return s / w;
}
