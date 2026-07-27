export function usd(n: number) {
  if (!Number.isFinite(n)) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: n >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(n);
}

export function compact(n: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(n || 0);
}

export function num(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
}

export function shortHash(hash: string, left = 6, right = 4) {
  if (!hash || hash.length < left + right) return hash;
  return `${hash.slice(0, left)}...${hash.slice(-right)}`;
}

export function ago(ts: string | number, now = Date.now()) {
  const t = typeof ts === "number" ? ts : new Date(ts).getTime();
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return `${s} secs ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  return `${h} hr${h === 1 ? "" : "s"} ago`;
}

export function pct(n?: number) {
  if (n == null || Number.isNaN(n)) return null;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
