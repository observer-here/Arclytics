const KEY = "arclytics.eco.snaps.v1";

type Snap = {
  at: number;
  volume24h: number;
  fees24h: number;
  protocols: number;
  stableMcap: number;
};

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
    localStorage.setItem(KEY, JSON.stringify(snaps.slice(-60)));
  } catch {
    // ignore
  }
}

export function recordEcoSnapshot(s: Omit<Snap, "at">) {
  const snaps = load();
  const now = Date.now();
  const day = Math.floor(now / 86_400_000);
  const idx = snaps.findIndex((x) => Math.floor(x.at / 86_400_000) === day);
  const next = { at: now, ...s };
  if (idx >= 0) snaps[idx] = next;
  else snaps.push(next);
  save(snaps);
}

export function ecoChangePct(
  key: keyof Omit<Snap, "at">,
  current: number,
): number | undefined {
  const snaps = load();
  if (!snaps.length || !Number.isFinite(current)) return undefined;
  const target = Date.now() - 86_400_000;
  let best: Snap | null = null;
  for (const s of snaps) {
    if (s.at > target + 12 * 3_600_000) continue;
    if (!best || s.at > best.at) best = s;
  }
  if (!best) {
    const oldest = snaps[0];
    if (!oldest || (Date.now() - oldest.at) / 86_400_000 < 0.7) return undefined;
    best = oldest;
  }
  const prev = best[key];
  if (prev == null || prev <= 0) return undefined;
  return ((current - prev) / prev) * 100;
}
