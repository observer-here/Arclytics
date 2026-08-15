import type { Env } from "./env";

export type PageParams = Record<string, string | number> | null;

export type Paged<T> = {
  items: T[];
  nextPageParams: PageParams;
};

function withParams(path: string, params?: PageParams) {
  if (!params) return path;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function createArcscan(env: Env) {
  const base = env.ARCSCAN_BASE.replace(/\/$/, "");

  async function get<T>(path: string): Promise<T> {
    let lastErr: Error | null = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const res = await fetch(`${base}${path}`, {
          headers: { accept: "application/json" },
        });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`ArcScan ${path} -> ${res.status}`);
          await sleep(800 * 2 ** attempt);
          continue;
        }
        if (!res.ok) throw new Error(`ArcScan ${path} -> ${res.status}`);
        return res.json() as Promise<T>;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (attempt < 3) await sleep(400 * 2 ** attempt);
      }
    }
    throw lastErr ?? new Error(`ArcScan ${path} failed`);
  }

  async function paged<T>(path: string, params?: PageParams): Promise<Paged<T>> {
    const data = await get<{
      items?: T[];
      next_page_params?: Record<string, string | number> | null;
    }>(withParams(path, params));
    return {
      items: data.items ?? [],
      nextPageParams: data.next_page_params ?? null,
    };
  }

  return {
    address: (addr: string) => get<Record<string, unknown>>(`/addresses/${addr}`),
    addressTokens: (addr: string) =>
      paged<Record<string, unknown>>(`/addresses/${addr}/tokens?type=ERC-20`),
    addressCounters: (addr: string) =>
      get<Record<string, unknown>>(`/addresses/${addr}/counters`),
    addressTokenTransfers: (addr: string, params?: PageParams) =>
      paged<Record<string, unknown>>(`/addresses/${addr}/token-transfers`, params),
    addressTransactions: (addr: string, params?: PageParams) =>
      paged<Record<string, unknown>>(`/addresses/${addr}/transactions`, params),
    /** Daily native-coin (USDC on Arc) balance — ~10 days of real history. */
    coinBalanceHistoryByDay: (addr: string) =>
      get<{ items?: Array<{ date?: string; value?: string }>; days?: number }>(
        `/addresses/${addr}/coin-balance-history-by-day`,
      ),
    transaction: (hash: string) => get<Record<string, unknown>>(`/transactions/${hash}`),
    stats: () => get<Record<string, unknown>>("/stats"),
    token: (addr: string) => get<Record<string, unknown>>(`/tokens/${addr}`),
    tokenCounters: (addr: string) =>
      get<{ token_holders_count?: string; transfers_count?: string }>(
        `/tokens/${addr}/counters`,
      ),
    tokenTransfers: (addr: string, params?: PageParams) =>
      paged<Record<string, unknown>>(`/tokens/${addr}/transfers`, params),
    tokenHolders: (addr: string, params?: PageParams) =>
      paged<Record<string, unknown>>(`/tokens/${addr}/holders`, params),
  };
}

export type Arcscan = ReturnType<typeof createArcscan>;
