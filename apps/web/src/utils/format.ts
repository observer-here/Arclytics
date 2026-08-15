export function usd(n: number) {
  if (!Number.isFinite(n)) return "$0";
  const abs = Math.abs(n);
  const digits = abs >= 10_000 ? 2 : abs >= 1 ? 2 : abs >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: abs >= 10_000 ? "compact" : "standard",
    maximumFractionDigits: digits,
  }).format(n);
}

/** Arc native gas is USDC (18 decimals in ArcScan fee.value). */
export function usdc(n: number) {
  if (!Number.isFinite(n)) return "—";
  if (n <= 0) return "0 USDC";
  if (n >= 10_000) return `${compact(n)} USDC`;
  const digits = n >= 1 ? 2 : n >= 0.01 ? 3 : 4;
  return `${n.toFixed(digits)} USDC`;
}

export function feeUsdc(raw: unknown) {
  const v = Number(raw ?? 0);
  if (!Number.isFinite(v) || v <= 0) return "—";
  return usdc(v / 1e18);
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
  if (!Number.isFinite(t) || t <= 0) return "—";
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return `${s} secs ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} hr${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function pct(n?: number) {
  if (n == null || Number.isNaN(n)) return null;
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
