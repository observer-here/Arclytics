export const API_BASE = (
  import.meta.env.VITE_API_URL || "https://arclytics-api.dartajamul108.workers.dev"
).replace(/\/$/, "");

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${path} -> ${res.status}${body ? `: ${body}` : ""}`);
  }
  return res.json() as Promise<T>;
}

export type ProtocolRanking = {
  slug: string;
  name: string;
  category: string;
  tvlUsd: number;
  volume24h: number;
  fees24h?: number;
  age?: string;
  txs: number;
  transfers: number;
  contracts: string[];
  spark7d: number[];
  change24h?: number;
  change7d?: number;
  change1m?: number;
  mcapTvl?: number;
  activeUsers24h?: number;
  updatedAt?: number;
};

export type ProtocolDetail = {
  protocol: {
    slug: string;
    name: string;
    category: string;
    description?: string;
    website?: string;
    docs?: string;
    twitter?: string;
    discord?: string;
    feeBps?: number;
    contracts: Array<{ address: string; role: string; label?: string }>;
  };
  rank: number;
  tvlUsd: number;
  volume24h: number;
  fees24h: number;
  change24h?: number;
  changeVol?: number;
  changeFees?: number;
  changeUsers?: number;
  activeUsers: number;
  age?: string;
  tvlSeries: Array<{ date: string; value: number }>;
  volSeries: Array<{ date: string; value: number }>;
  feeSpark: number[];
  tvlSpark: number[];
  volSpark: number[];
  userSpark: number[];
  contracts: Array<{
    address: string;
    label: string;
    role: string;
    tvlUsd: number;
    txs: number;
    transfers: number;
  }>;
  breakdown: Array<{ label: string; value: number }>;
  pairs: Array<{ pair: string; volume24h: number; apr: number }>;
  activity: {
    txs: Array<{ date: string; value: number }>;
    transfers: Array<{ date: string; value: number }>;
    unique: Array<{ date: string; value: number }>;
  };
  txs: Array<Record<string, unknown>>;
  totals: { txs: number; transfers: number };
  paymentStats?: {
    lifetimeCalls: number;
    loggedVolumeUsd: number;
    routerReceivedUsd: number;
    routerSentUsd: number;
    uniqueRecipients?: number;
  };
  updatedAt?: number;
};

export type EcosystemFeed = {
  rows: Array<{
    slug: string;
    name: string;
    category: string;
    tvlUsd: number;
    change24h?: number;
    change7d?: number;
    change1m?: number;
    volume24h?: number;
    fees24h?: number;
    mcapTvl?: number;
    age?: string;
    spark7d?: number[];
  }>;
  spark: number[];
  stats: {
    tvlUsd: number;
    tvlChange?: number;
    protocolChange?: number;
    volume24h: number;
    volumeChange?: number;
    fees24h: number;
    feesChange?: number;
    activeUsers: number;
    usersChange?: number;
    transactions: number;
    txChange?: number;
    stableMcap: number;
    stableChange?: number;
  };
  updatedAt?: number;
};

export async function getProtocolRankings(): Promise<ProtocolRanking[]> {
  const data = await get<{ items: ProtocolRanking[] }>("/v1/protocols");
  return data.items ?? [];
}

export async function loadProtocolDetail(slug: string): Promise<ProtocolDetail | null> {
  try {
    return await get<ProtocolDetail>(`/v1/protocols/${encodeURIComponent(slug)}`);
  } catch {
    return null;
  }
}

export async function loadEcosystemFeed(): Promise<EcosystemFeed> {
  return get<EcosystemFeed>("/v1/ecosystem");
}

export type TokenFeedRow = {
  address: string;
  name: string;
  symbol: string;
  holders: number;
  transfers: number;
  interest: number;
  iconUrl?: string;
  price: number | null;
  marketCap: number | null;
  volume24h: number | null;
  change24h?: number | null;
  change7d?: number | null;
  category: string;
  protocol: string;
  amm: string;
  blurb?: string;
};

export async function getTokens(): Promise<{ items: TokenFeedRow[]; updatedAt: number }> {
  return get<{ items: TokenFeedRow[]; updatedAt: number }>("/v1/tokens");
}

export type WalletFeedRow = {
  address: string;
  label: string;
  name?: string;
  netWorth: number;
  change24h: number | null;
  change7d: number | null;
  txs24h: number;
  txsTotal: number;
  lastActive: string | null;
  spark24h: number[];
  spark7d: number[];
  breakdown: { stable: number; defi: number; tokens: number; nft: number; other: number };
};

export async function getWallets(): Promise<{
  items: WalletFeedRow[];
  stats: Record<string, unknown> | null;
  updatedAt?: number;
  stale?: boolean;
  message?: string;
}> {
  return get("/v1/wallets");
}

/** Live ArcScan metrics for visible wallets (max 10). Not from D1. */
export type WalletLiveRow = {
  lastActive: string | null;
  change24h: number | null;
  delta24h: number | null;
  spark24h: number[];
};

export type WalletMover = { address: string; change: number; delta: number };

export type WalletInsights = {
  netFlow24h: number;
  avgAgeDays: number;
  activeRate: number;
  active24h: number;
  sample: number;
};

export async function getWalletLive(
  addresses: string[],
): Promise<Record<string, WalletLiveRow>> {
  const res = await fetch(`${API_BASE}/v1/wallets/live`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ addresses: addresses.slice(0, 10) }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API /v1/wallets/live -> ${res.status}${body ? `: ${body}` : ""}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      address: string;
      lastActive: string | null;
      change24h: number | null;
      delta24h: number | null;
      spark24h?: number[];
    }>;
  };
  return Object.fromEntries(
    (data.items ?? []).map((r) => [
      r.address.toLowerCase(),
      {
        lastActive: r.lastActive,
        change24h: r.change24h,
        delta24h: r.delta24h,
        spark24h: r.spark24h ?? [],
      },
    ] as const),
  );
}

/** Live ArcScan movers + insights for D1 top-100 (Worker reads addresses from D1). */
export async function getWalletMovers(): Promise<{
  gainers: WalletMover[];
  losers: WalletMover[];
  insights: WalletInsights;
}> {
  const res = await fetch(`${API_BASE}/v1/wallets/movers`, {
    method: "GET",
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API /v1/wallets/movers -> ${res.status}${body ? `: ${body}` : ""}`);
  }
  const data = (await res.json()) as {
    gainers?: WalletMover[];
    losers?: WalletMover[];
    insights?: WalletInsights;
  };
  return {
    gainers: data.gainers ?? [],
    losers: data.losers ?? [],
    insights: data.insights ?? {
      netFlow24h: 0,
      avgAgeDays: 0,
      activeRate: 0,
      active24h: 0,
      sample: 0,
    },
  };
}

