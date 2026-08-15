import { CURATED_TOKENS, RESERVE_USD } from "@arclytics/chain";
import type { Arcscan, PageParams } from "./arcscan";
import { getMeta, getTokens, getWallets, saveWallets, setMeta } from "./db";
import type { Env } from "./env";

type TokenFeed = {
  address: string;
  symbol?: string;
  category?: string;
  price: number | null;
  marketCap: number | null;
  interest?: number;
  holders?: number;
};

type Capital = { total: number; stable: number; defi: number; tokens: number };

type WalletRow = {
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

const TOP_N = 100;
const MAX_TOKENS = 8;
const ENRICH_N = 25;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseAmt(raw: unknown, decimals = 18) {
  const v = Number(raw ?? 0);
  const d = Number.isFinite(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18;
  return Number.isFinite(v) ? v / 10 ** d : 0;
}

function inferLabel(netWorth: number, txs: number) {
  if (netWorth >= 50_000) return "Whale";
  if (txs >= 500) return "Top Trader";
  if (txs >= 80 && netWorth >= 500) return "Smart Money";
  if (txs < 15) return "New Wallet";
  return "DeFi User";
}

function bucket(tokenAddr: string, category: string, symbol: string): keyof Omit<Capital, "total"> {
  if (
    RESERVE_USD[tokenAddr] ||
    symbol === "USDC" ||
    symbol === "EURC" ||
    symbol === "USDT" ||
    category === "Stablecoin" ||
    category === "RWA"
  ) {
    return "stable";
  }
  if (category === "DeFi") return "defi";
  return "tokens";
}

async function holdersForToken(arc: Arcscan, tokenAddr: string, decimals: number) {
  const batch = await arc.tokenHolders(tokenAddr).catch(() => ({
    items: [] as Array<Record<string, unknown>>,
    nextPageParams: null as PageParams,
  }));
  const rows: Array<{ addr: string; amount: number }> = [];
  for (const item of batch.items ?? []) {
    const addrObj = item.address as { hash?: string; is_contract?: boolean } | undefined;
    const addr = String(addrObj?.hash ?? "").toLowerCase();
    if (!addr || addrObj?.is_contract) continue;
    const amount = parseAmt(item.value, decimals);
    if (amount <= 0) continue;
    rows.push({ addr, amount });
  }
  return rows;
}

export async function ingestWallets(env: Env, arc: Arcscan) {
  const feed = await getTokens(env);
  const items = (feed?.items ?? []) as TokenFeed[];

  const priceMap: Record<string, number> = { ...RESERVE_USD };
  for (const t of items) {
    if (t.price != null && t.price > 0) priceMap[t.address.toLowerCase()] = t.price;
  }
  for (const t of CURATED_TOKENS) {
    const a = t.address.toLowerCase();
    if (priceMap[a] == null && t.pegUsd) priceMap[a] = RESERVE_USD[a] ?? 1;
  }

  const curatedAddrs = new Set(CURATED_TOKENS.map((t) => t.address.toLowerCase()));
  const fromFeed = [...items]
    .filter((t) => {
      const addr = t.address.toLowerCase();
      const price = priceMap[addr] ?? 0;
      if (!(price > 0)) return false;
      if (curatedAddrs.has(addr)) return true;
      const mcap = t.marketCap ?? 0;
      return mcap > 0 && mcap < 5_000_000_000;
    })
    .sort((a, b) => (b.marketCap ?? b.interest ?? 0) - (a.marketCap ?? a.interest ?? 0));

  const scanList: TokenFeed[] = [];
  for (const t of CURATED_TOKENS) {
    const addr = t.address.toLowerCase();
    const price = priceMap[addr] ?? 0;
    if (!(price > 0)) continue;
    if (scanList.length >= MAX_TOKENS) break;
    scanList.push({
      address: t.address,
      symbol: "",
      category: t.category,
      price,
      marketCap: null,
      holders: 1,
    });
  }
  for (const t of fromFeed) {
    if (scanList.length >= MAX_TOKENS) break;
    if (scanList.some((x) => x.address.toLowerCase() === t.address.toLowerCase())) continue;
    scanList.push(t);
  }

  const capital = new Map<string, Capital>();
  const decimalsCache = new Map<string, number>();

  for (const token of scanList) {
    const tokenAddr = token.address.toLowerCase();
    const price = priceMap[tokenAddr] ?? 0;
    if (!(price > 0)) continue;

    let decimals = decimalsCache.get(tokenAddr);
    if (decimals == null) {
      const meta = await arc.token(token.address).catch(() => null);
      const d = Number(meta?.decimals);
      decimals = Number.isFinite(d) && d >= 0 && d <= 36 ? d : 18;
      decimalsCache.set(tokenAddr, decimals);
      await sleep(350);
    }

    const holders = await holdersForToken(arc, token.address, decimals);
    await sleep(350);
    const key = bucket(tokenAddr, String(token.category ?? ""), String(token.symbol ?? "").toUpperCase());

    for (const h of holders) {
      const usd = h.amount * price;
      if (!(usd > 0) || usd > 50_000_000) continue;
      const prev = capital.get(h.addr) ?? { total: 0, stable: 0, defi: 0, tokens: 0 };
      prev.total += usd;
      prev[key] += usd;
      capital.set(h.addr, prev);
    }
  }

  const ranked = [...capital.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, TOP_N);

  const wallets: WalletRow[] = [];
  for (let i = 0; i < ranked.length; i++) {
    const [addr, cap] = ranked[i];
    let txsTotal = 0;
    let lastActive: string | null = null;
    let name: string | undefined;
    let native = 0;

    if (i < ENRICH_N) {
      const [profile, counters, recent] = await Promise.all([
        arc.address(addr).catch(() => null),
        arc.addressCounters(addr).catch(() => null),
        arc.addressTransactions(addr).catch(() => ({ items: [] as Array<Record<string, unknown>> })),
      ]);
      await sleep(350);
      native = parseAmt(profile?.coin_balance);
      txsTotal = Number(counters?.transactions_count ?? 0);
      lastActive =
        recent.items?.[0]?.timestamp != null ? String(recent.items[0].timestamp) : null;
      name = profile?.name
        ? String(profile.name)
        : profile?.ens_domain_name
          ? String(profile.ens_domain_name)
          : undefined;
    }

    const netWorth = cap.total + (native > 0 ? native : 0);
    const lastMs = lastActive ? new Date(lastActive).getTime() : 0;
    const txs24h =
      lastMs > 0 && Date.now() - lastMs < 86_400_000
        ? Math.max(1, Math.round(txsTotal * 0.02))
        : 0;

    wallets.push({
      address: addr,
      name,
      label: inferLabel(netWorth, txsTotal),
      netWorth,
      change24h: null,
      change7d: null,
      txs24h,
      txsTotal,
      lastActive,
      spark24h: [netWorth],
      spark7d: [netWorth],
      breakdown: {
        stable: cap.stable + (native > 0 ? native : 0),
        defi: cap.defi,
        tokens: cap.tokens,
        nft: 0,
        other: 0,
      },
    });
  }

  wallets.sort((a, b) => b.netWorth - a.netWorth);

  const totalValue = wallets.reduce((s, w) => s + w.netWorth, 0);
  const top10Value = wallets.slice(0, 10).reduce((s, w) => s + w.netWorth, 0);
  const active24h = wallets.filter((w) => w.txs24h > 0).length;
  const txs24h = wallets.reduce((s, w) => s + w.txs24h, 0);
  const portfolio = [
    { label: "Stablecoins", value: wallets.reduce((s, w) => s + w.breakdown.stable, 0) },
    { label: "DeFi", value: wallets.reduce((s, w) => s + w.breakdown.defi, 0) },
    { label: "Tokens", value: wallets.reduce((s, w) => s + w.breakdown.tokens, 0) },
  ].filter((s) => s.value > 0);

  const stats = {
    tracked: wallets.length,
    totalValue,
    top10Value,
    active24h,
    txs24h,
    netFlow24h: 0,
    avgAgeDays: Math.round(txs24h / Math.max(active24h, 1)),
    activeRate: wallets.length ? (active24h / wallets.length) * 100 : 0,
    valueSpark: wallets[0]?.spark7d ?? [],
    txSpark: [] as number[],
    portfolio,
    gainers: [] as Array<{ address: string; change: number; delta: number }>,
    losers: [] as Array<{ address: string; change: number; delta: number }>,
  };

  const updatedAt = Date.now();
  await saveWallets(env, { items: wallets, stats, updatedAt });
  await setMeta(env, "last_wallets_ingest", String(updatedAt));
  return { ok: true, count: wallets.length, updatedAt };
}

export async function maybeIngestWallets(env: Env, arc: Arcscan, minAgeMs = 30 * 60_000) {
  const last = Number((await getMeta(env, "last_wallets_ingest")) ?? "0") || 0;
  if (Date.now() - last < minAgeMs) return { skipped: true, last };
  return ingestWallets(env, arc);
}

export async function readWallets(env: Env) {
  return getWallets(env);
}
