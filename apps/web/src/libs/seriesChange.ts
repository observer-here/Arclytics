export type SeriesPoint = { date: string; value: number; approx?: boolean };

/** Day-over-day % using last two complete points (skips approximate/partial today). */
export function dayOverDayPct(series: SeriesPoint[]): number | undefined {
  const pts = series.filter((p) => Number.isFinite(p.value));
  if (pts.length < 2) return undefined;
  let i = pts.length - 1;
  if (pts[i].approx) i -= 1;
  if (i < 1) return undefined;
  const cur = pts[i].value;
  const prev = pts[i - 1].value;
  if (!prev) return undefined;
  return ((cur - prev) / prev) * 100;
}

/** 24h growth of a cumulative total: added / (total - added). */
export function growthFromAdded(total: number, added24h: number): number | undefined {
  if (!Number.isFinite(total) || !Number.isFinite(added24h) || added24h < 0) return undefined;
  const base = total - added24h;
  if (base <= 0) return undefined;
  return (added24h / base) * 100;
}

/** Last complete day's value from a daily series. */
export function lastCompleteValue(series: SeriesPoint[]): number | undefined {
  const pts = series.filter((p) => Number.isFinite(p.value));
  if (!pts.length) return undefined;
  const last = pts[pts.length - 1];
  if (last.approx && pts.length >= 2) return pts[pts.length - 2].value;
  return last.value;
}

/** Daily deltas from a cumulative growth series, then DoD % on those deltas. */
export function cumulativeDeltaDoD(series: SeriesPoint[]): number | undefined {
  const pts = series.filter((p) => Number.isFinite(p.value));
  if (pts.length < 3) return undefined;
  let end = pts.length - 1;
  if (pts[end].approx) end -= 1;
  if (end < 2) return undefined;
  const today = pts[end].value - pts[end - 1].value;
  const yesterday = pts[end - 1].value - pts[end - 2].value;
  if (!yesterday) return undefined;
  return ((today - yesterday) / Math.abs(yesterday)) * 100;
}

/** TVL-weighted average of protocol 24h changes. */
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
