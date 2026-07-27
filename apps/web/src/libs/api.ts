const PROD_API = "https://arclytics-api.dartajamul108.workers.dev";

const API_BASE = (
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? "/api" : PROD_API)
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
