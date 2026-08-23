import { CURATED_TOKENS, RESERVE_USD } from "@arclytics/chain";
import { getWallets } from "@/libs/api";
import {
  loadAddressProfile,
  loadAddressTokenList,
  loadAddressTxList,
  mergeHoldings,
  type AddressToken,
  type AddressTx,
} from "@/libs/addressDetail";
import { clearCache, fetchCache } from "@/libs/queryCache";

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

export type WalletStats = {
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

export const WALLET = {
  api: "wallet-api-v10",
  list: "wallet-list-v10",
  valued: "wallet-valued-v10",
  stats: "wallet-stats-v10",
  activity: "wallet-activity-v10",
} as const;

const DAY_MS = 86_400_000;
const ACTIVITY_WALLETS = 8;
const ACTIVITY_PER = 6;
/** Live-price top wallets (native USDC + EURC + all priced ERC-20s + last tx). */
const VALUE_TOP = 25;

function emptyStats(tracked = 0): WalletStats {
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

function extraKey(extra: string[]) {
  return extra.join(",");
}

function normalizeRow(w: WalletRow): WalletRow {
  return {
    ...w,
    change24h: w.change24h ?? null,
    change7d: w.change7d ?? null,
    spark24h: w.spark24h?.length ? w.spark24h : [w.netWorth],
    spark7d: w.spark7d?.length ? w.spark7d : [w.netWorth],
    breakdown: w.breakdown ?? { stable: 0, defi: 0, tokens: 0, nft: 0, other: 0 },
  };
}

function inferLabel(netWorth: number, txs: number) {
  if (netWorth >= 50_000) return "Whale";
  if (txs >= 500) return "Top Trader";
  if (txs >= 80 && netWorth >= 500) return "Smart Money";
  if (txs < 15) return "New Wallet";
  return "DeFi User";
}

function holdingBucket(t: AddressToken): "stable" | "defi" | "tokens" {
  const a = t.address.toLowerCase();
  const sym = (t.symbol || "").toUpperCase();
  if (
    t.type === "native" ||
    RESERVE_USD[a] != null ||
    ["USDC", "EURC", "USDT", "WUSDC"].includes(sym)
  ) {
    return "stable";
  }
  const cat = CURATED_TOKENS.find((c) => c.address.toLowerCase() === a)?.category;
  if (cat === "Stablecoin" || cat === "RWA") return "stable";
  if (cat === "DeFi") return "defi";
  return "tokens";
}

function breakdownFromHoldings(holdings: AddressToken[]) {
  const b = { stable: 0, defi: 0, tokens: 0, nft: 0, other: 0 };
  for (const t of holdings) {
    if (!(t.valueUsd > 0)) continue;
    b[holdingBucket(t)] += t.valueUsd;
  }
  return b;
}

function txsIn24h(txs: AddressTx[]) {
  const cut = Date.now() - DAY_MS;
  return txs.filter((t) => t.timestamp && new Date(t.timestamp).getTime() >= cut).length;
}

function emptyRow(addr: string): WalletRow {
  return {
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
  };
}

/** Full live valuation: native USDC + every priced token (EURC, stables, DeFi, …) + last tx. */
export async function enrichWallet(addr: string, base?: WalletRow): Promise<WalletRow> {
  const [profile, tokens, txs] = await Promise.all([
    loadAddressProfile(addr),
    loadAddressTokenList(addr),
    loadAddressTxList(addr),
  ]);
  const holdings = mergeHoldings(profile?.nativeUsdc ?? 0, tokens);
  const netWorth = holdings.reduce((s, t) => s + t.valueUsd, 0);
  const txsTotal = profile?.txCount ?? base?.txsTotal ?? txs.length;
  return {
    address: addr,
    name: profile?.name || profile?.ens || base?.name,
    label: base?.label || inferLabel(netWorth, txsTotal),
    netWorth,
    change24h: base?.change24h ?? null,
    change7d: base?.change7d ?? null,
    txs24h: txsIn24h(txs),
    txsTotal,
    lastActive: txs[0]?.timestamp ?? base?.lastActive ?? null,
    spark24h: base?.spark24h?.length ? base.spark24h : [netWorth],
    spark7d: base?.spark7d?.length ? base.spark7d : [netWorth],
    breakdown: breakdownFromHoldings(holdings),
  };
}

function loadApi(extra: string[] = []) {
  return fetchCache(`${WALLET.api}:${extraKey(extra)}`, async () => {
    const data = await getWallets();
    const items = ((data.items ?? []) as WalletRow[]).map(normalizeRow);
    const known = new Set(items.map((w) => w.address.toLowerCase()));
    const extras = [
      ...new Set(extra.map((a) => a.toLowerCase()).filter((a) => /^0x[a-f0-9]{40}$/.test(a))),
    ].filter((a) => !known.has(a));
    return {
      items,
      extras,
      stats: (data.stats as WalletStats | null) ?? emptyStats(items.length),
    };
  });
}

export function computeStats(wallets: WalletRow[], base?: WalletStats | null): WalletStats {
  const totalValue = wallets.reduce((s, w) => s + w.netWorth, 0);
  const top10Value = wallets.slice(0, 10).reduce((s, w) => s + w.netWorth, 0);
  const active24h = wallets.filter((w) => {
    if (w.txs24h > 0) return true;
    if (!w.lastActive) return false;
    return Date.now() - new Date(w.lastActive).getTime() < DAY_MS;
  }).length;
  const walletTxSum = wallets.reduce((s, w) => s + w.txs24h, 0);
  const txs24h =
    base?.txs24h != null && base.txs24h > walletTxSum ? base.txs24h : walletTxSum;
  const portfolio = [
    { label: "Stablecoins", value: wallets.reduce((s, w) => s + w.breakdown.stable, 0) },
    { label: "DeFi", value: wallets.reduce((s, w) => s + w.breakdown.defi, 0) },
    { label: "Tokens", value: wallets.reduce((s, w) => s + w.breakdown.tokens, 0) },
  ].filter((s) => s.value > 0);

  return {
    tracked: wallets.length,
    totalValue,
    top10Value,
    active24h,
    txs24h,
    netFlow24h: base?.netFlow24h ?? 0,
    avgAgeDays: base?.avgAgeDays ?? 0,
    activeRate: wallets.length ? (active24h / wallets.length) * 100 : 0,
    valueSpark: base?.valueSpark?.length ? base.valueSpark : (wallets[0]?.spark7d ?? []),
    txSpark: base?.txSpark ?? [],
    portfolio,
    gainers: base?.gainers ?? [],
    losers: base?.losers ?? [],
  };
}

function mapActivity(tx: AddressTx, address: string): WalletActivity {
  return {
    hash: tx.hash,
    time: tx.timestamp ?? "",
    address,
    action: tx.method || "Transfer",
    target: tx.tokenSymbol || "USDC",
    valueUsd: tx.valueUsdc,
  };
}

/** Fast list — API rows + tracked extras only (independent paint). */
export async function loadWalletList(extra: string[] = []): Promise<WalletRow[]> {
  const api = await loadApi(extra);
  const byAddr = new Map(api.items.map((w) => [w.address.toLowerCase(), w] as const));

  if (api.extras.length) {
    await Promise.all(
      api.extras.map(async (addr) => {
        try {
          byAddr.set(addr, await enrichWallet(addr));
        } catch {
          byAddr.set(addr, emptyRow(addr));
        }
      }),
    );
  }

  return [...byAddr.values()].sort((a, b) => b.netWorth - a.netWorth);
}

/**
 * Full valuation pass: top wallets + tracked get live token prices (USDC, EURC, …)
 * and last-tx / 24h tx counts. Runs after fast list so UI stays independent.
 */
export async function loadWalletValued(extra: string[] = []): Promise<WalletRow[]> {
  const api = await loadApi(extra);
  const byAddr = new Map(api.items.map((w) => [w.address.toLowerCase(), w] as const));

  const top = [...api.items]
    .sort((a, b) => b.netWorth - a.netWorth)
    .slice(0, VALUE_TOP)
    .map((w) => w.address.toLowerCase());
  const toValue = [...new Set([...api.extras, ...top])];

  await Promise.all(
    toValue.map(async (addr) => {
      const base = byAddr.get(addr);
      try {
        byAddr.set(addr, await enrichWallet(addr, base));
      } catch {
        if (!byAddr.has(addr)) byAddr.set(addr, emptyRow(addr));
      }
    }),
  );

  return [...byAddr.values()].sort((a, b) => b.netWorth - a.netWorth);
}

/** Fast stats from API (network txs kept). */
export async function loadWalletStats(extra: string[] = []): Promise<WalletStats> {
  const api = await loadApi(extra);
  return {
    ...api.stats,
    tracked: Math.max(api.stats.tracked ?? 0, api.items.length + api.extras.length),
  };
}

/** Activity — independent ArcScan fetches. */
export async function loadWalletActivity(extra: string[] = []): Promise<WalletActivity[]> {
  const api = await loadApi(extra);
  const addrs = [
    ...new Set([
      ...api.extras,
      ...api.items.slice(0, ACTIVITY_WALLETS).map((w) => w.address.toLowerCase()),
    ]),
  ].slice(0, ACTIVITY_WALLETS);

  const pages = await Promise.all(
    addrs.map((addr) => loadAddressTxList(addr).catch(() => [] as AddressTx[])),
  );
  const rows: WalletActivity[] = [];
  addrs.forEach((addr, i) => {
    for (const tx of (pages[i] ?? []).slice(0, ACTIVITY_PER)) {
      if (!tx.hash) continue;
      rows.push(mapActivity(tx, addr));
    }
  });
  return rows
    .sort((a, b) => new Date(b.time || 0).getTime() - new Date(a.time || 0).getTime())
    .slice(0, 24);
}

export function clearWalletCaches(extra: string[] = []) {
  const k = extraKey(extra);
  clearCache(`${WALLET.api}:${k}`);
  clearCache(`${WALLET.list}:${k}`);
  clearCache(`${WALLET.valued}:${k}`);
  clearCache(`${WALLET.stats}:${k}`);
  clearCache(`${WALLET.activity}:${k}`);
}
