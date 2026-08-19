const BASE =
  import.meta.env.VITE_ARCSCAN_BASE_URL ??
  (import.meta.env.DEV ? "/arcscan" : "https://testnet.arcscan.app/api/v2");

const STATS =
  import.meta.env.VITE_ARCSCAN_STATS_URL ??
  (import.meta.env.DEV ? "/arcstats" : "https://testnet.arcscan.app/stats-service/api/v1");

export type PageParams = Record<string, string | number> | null;

export type Paged<T> = {
  items: T[];
  nextPageParams: PageParams;
};

/** ArcScan default list page size (transactions, blocks, etc.). */
export const ARCSCAN_PAGE_SIZE = 50;

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    cache: "no-store",
    ...init,
  });
  if (!res.ok) throw new Error(`ArcScan ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

async function getStats<T>(path: string): Promise<T> {
  const res = await fetch(`${STATS}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`ArcStats ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

function withParams(path: string, params?: PageParams) {
  if (!params) return path;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  if (!s) return path;
  return path.includes("?") ? `${path}&${s}` : `${path}?${s}`;
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

async function statsLine(name: string) {
  const data = await getStats<{
    chart: Array<{ date: string; value: string; is_approximate?: boolean }>;
  }>(`/lines/${encodeURIComponent(name)}`);
  return (data.chart ?? []).map((d) => ({
    date: d.date,
    value: Number(d.value ?? 0),
    approx: Boolean(d.is_approximate),
  }));
}

export const arcscan = {
  stats: () => get<Record<string, unknown>>("/stats"),
  txChart: () => statsLine("newTxns"),
  newAccountsChart: () => statsLine("newAccounts"),
  /** Daily USDC transfer count (native coin) — used as network volume proxy. */
  usdcVolumeChart: () => statsLine("newNativeCoinTransfers"),
  statsLine,
  statsCounters: async () => {
    const data = await getStats<{
      counters: Array<{ id: string; value: string; title?: string }>;
    }>("/counters");
    return Object.fromEntries(
      (data.counters ?? []).map((c) => [c.id, Number(c.value ?? 0)]),
    ) as Record<string, number>;
  },
  statsPageContracts: async () => {
    const data = await getStats<Record<string, { value?: string } | null>>("/pages/contracts");
    return {
      total: Number(data.total_contracts?.value ?? 0),
      new24h: Number(data.new_contracts_24h?.value ?? 0),
      verified: Number(data.total_verified_contracts?.value ?? 0),
      verifiedNew24h: Number(data.new_verified_contracts_24h?.value ?? 0),
    };
  },
  tokens: (type = "ERC-20", params?: PageParams) =>
    paged<Record<string, unknown>>(`/tokens?type=${encodeURIComponent(type)}`, params),
  token: (address: string) => get<Record<string, unknown>>(`/tokens/${address}`),
  tokenCounters: (address: string) =>
    get<{ token_holders_count?: string; transfers_count?: string }>(
      `/tokens/${address}/counters`,
    ),
  tokenHolders: (address: string, params?: PageParams) =>
    paged<Record<string, unknown>>(`/tokens/${address}/holders`, params),
  tokenTransfers: (address: string, params?: PageParams) =>
    paged<Record<string, unknown>>(`/tokens/${address}/transfers`, params),
  mainPageBlocks: () => get<Array<Record<string, unknown>>>("/main-page/blocks"),
  blocksPage: (params?: PageParams) => paged<Record<string, unknown>>("/blocks", params),
  recentTransactions: async () => {
    const data = await get<{ items: Array<Record<string, unknown>> }>("/transactions");
    return data.items ?? [];
  },
  transactionsPage: (params?: PageParams) =>
    paged<Record<string, unknown>>("/transactions", params),
  search: (q: string) =>
    get<Array<Record<string, unknown>>>(`/search/quick?q=${encodeURIComponent(q)}`),
  addressTokens: (address: string, type = "ERC-20") =>
    get<{ items: Array<Record<string, unknown>> }>(
      `/addresses/${address}/tokens?type=${encodeURIComponent(type)}`,
    ),
  addressCounters: (address: string) =>
    get<Record<string, string>>(`/addresses/${address}/counters`),
  address: (address: string) => get<Record<string, unknown>>(`/addresses/${address}`),
  coinBalanceHistoryByDay: (address: string) =>
    get<{ items?: Array<{ date?: string; value?: string }> }>(
      `/addresses/${address}/coin-balance-history-by-day`,
    ),
  addressTokenTransfers: (address: string, params?: PageParams) =>
    paged<Record<string, unknown>>(`/addresses/${address}/token-transfers`, params),
  addressTransactions: (address: string, params?: PageParams) =>
    paged<Record<string, unknown>>(`/addresses/${address}/transactions`, params),
  transaction: (hash: string) => get<Record<string, unknown>>(`/transactions/${hash}`),
  smartContractCounters: () =>
    get<Record<string, string>>("/smart-contracts/counters"),
};
