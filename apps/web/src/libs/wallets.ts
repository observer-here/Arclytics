import { getWallets } from "@/libs/api";

export type WalletRow = {
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

export type WalletActivity = {
  hash: string;
  time: string;
  address: string;
  action: string;
  target: string;
  valueUsd: number;
};

export type WalletDashboard = {
  wallets: WalletRow[];
  activity: WalletActivity[];
  stats: {
    tracked: number;
    totalValue: number;
    top10Value: number;
    active24h: number;
    txs24h: number;
    netFlow24h: number;
    avgAgeDays: number;
    activeRate: number;
    valueSpark: number[];
    txSpark: number[];
    portfolio: Array<{ label: string; value: number }>;
    gainers: Array<{ address: string; change: number; delta: number }>;
    losers: Array<{ address: string; change: number; delta: number }>;
  };
};

function emptyStats(tracked = 0): WalletDashboard["stats"] {
  return {
    tracked,
    totalValue: 0,
    top10Value: 0,
    active24h: 0,
    txs24h: 0,
    netFlow24h: 0,
    avgAgeDays: 0,
    activeRate: 0,
    valueSpark: [],
    txSpark: [],
    portfolio: [],
    gainers: [],
    losers: [],
  };
}

export async function loadWalletDashboard(extra: string[] = []): Promise<WalletDashboard> {
  const data = await getWallets();
  const wallets = [...((data.items ?? []) as WalletRow[])];
  const known = new Set(wallets.map((w) => w.address.toLowerCase()));

  for (const raw of extra) {
    const addr = raw.toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(addr) || known.has(addr)) continue;
    wallets.push({
      address: addr,
      label: "New Wallet",
      netWorth: 0,
      change24h: null,
      change7d: null,
      txs24h: 0,
      txsTotal: 0,
      lastActive: null,
      spark24h: [0],
      spark7d: [0],
      breakdown: { stable: 0, defi: 0, tokens: 0, nft: 0, other: 0 },
    });
  }

  wallets.sort((a, b) => b.netWorth - a.netWorth);

  const stats = (data.stats as WalletDashboard["stats"] | null) ?? emptyStats(wallets.length);
  return {
    wallets,
    activity: [],
    stats: { ...stats, tracked: wallets.length },
  };
}
