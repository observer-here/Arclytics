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

export function createArcscan(env: Env) {
  const base = env.ARCSCAN_BASE.replace(/\/$/, "");

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) throw new Error(`ArcScan ${path} -> ${res.status}`);
    return res.json() as Promise<T>;
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
    transaction: (hash: string) => get<Record<string, unknown>>(`/transactions/${hash}`),
    stats: () => get<Record<string, unknown>>("/stats"),
    token: (addr: string) => get<Record<string, unknown>>(`/tokens/${addr}`),
  };
}

export type Arcscan = ReturnType<typeof createArcscan>;
