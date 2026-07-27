const KEY = "arclytics.tvl.snaps.v1";

type Snap = { at: number; tvl: Record<string, number> };

function load(): Snap[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Snap[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function save(snaps: Snap[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(snaps.slice(-120)));
  } catch {
    // ignore quota
  }
}

export function recordTvlSnapshot(tvl: Record<string, number>) {
  const snaps = load();
  const now = Date.now();
  const day = Math.floor(now / 86_400_000);
  const idx = snaps.findIndex((s) => Math.floor(s.at / 86_400_000) === day);
  const next = { at: now, tvl };
  if (idx >= 0) snaps[idx] = next;
  else snaps.push(next);
  save(snaps);
}

export function tvlChangePct(slug: string, current: number, days: number): number | undefined {
  const snaps = load();
  if (!snaps.length || !current) return undefined;
  const target = Date.now() - days * 86_400_000;
  let best: Snap | null = null;
  for (const s of snaps) {
    if (s.at > target + 12 * 3_600_000) continue;
    if (!best || s.at > best.at) best = s;
  }
  if (!best) {
    const oldest = snaps[0];
    if (!oldest || nowAgeDays(oldest.at) < days * 0.7) return undefined;
    best = oldest;
  }
  const prev = best.tvl[slug];
  if (prev == null || prev <= 0) return undefined;
  return ((current - prev) / prev) * 100;
}

function nowAgeDays(at: number) {
  return (Date.now() - at) / 86_400_000;
}
