import { addresses, CURATED_TOKENS, RESERVE_USD } from "@arclytics/chain";
import type { Arcscan } from "../arcscan";
import { getMeta, getTokens, saveWallets, setMeta } from "../db";
import type { Env } from "../../lib/env";

type TokenFeed = {
  address: string;
  symbol?: string;
  category?: string;
  price: number | null;
  marketCap: number | null;
  interest?: number;
};

type Capital = { total: number; stable: number; defi: number; tokens: number; usdc: number };

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
const SCAN_TOKENS = 37;
const SCAN_TOKENS_MAX = 60;
const VALUE_N = 100;
const USDC = addresses.usdc.toLowerCase();
const DAY_MS = 86_400_000;

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

function bucket(
  tokenAddr: string,
  category: string,
  symbol: string,
): keyof Omit<Capital, "total" | "usdc"> {
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

function categoryOf(addr: string, feedMap?: Map<string, string>) {
  const curated = CURATED_TOKENS.find((t) => t.address.toLowerCase() === addr)?.category;
  if (curated) return curated;
  return feedMap?.get(addr) ?? "";
}

async function holdersForToken(arc: Arcscan, tokenAddr: string, decimals: number) {
  const batch = await arc.tokenHolders(tokenAddr).catch(() => ({ items: [], nextPageParams: null }));
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

async function valuePortfolio(
  arc: Arcscan,
  addr: string,
  priceMap: Record<string, number>,
  feedMap: Map<string, string>,
): Promise<Capital & { native: number }> {
  const [profile, tokenPage] = await Promise.all([
    arc.address(addr).catch(() => null),
    arc.addressTokens(addr).catch(() => ({ items: [] })),
  ]);
  const native = parseAmt(profile?.coin_balance);
  const cap: Capital & { native: number } = {
    total: 0,
    stable: 0,
    defi: 0,
    tokens: 0,
    usdc: native,
    native,
  };
  if (native > 0) {
    cap.total += native;
    cap.stable += native;
  }

  for (const row of tokenPage.items ?? []) {
    const tok = (row.token ?? {}) as Record<string, unknown>;
    const tokenAddr = String(tok.address_hash ?? "").toLowerCase();
    if (!tokenAddr || tokenAddr === USDC) continue;
    const decimals = Number(tok.decimals ?? 18);
    const amount = parseAmt(row.value, decimals);
    if (!(amount > 0)) continue;
    const price =
      priceMap[tokenAddr] ??
      (tok.exchange_rate != null && Number(tok.exchange_rate) > 0
        ? Number(tok.exchange_rate)
        : null);
    if (!(price != null && price > 0)) continue;
    const usd = amount * price;
    if (!(usd > 0)) continue;
    const key = bucket(
      tokenAddr,
      categoryOf(tokenAddr, feedMap),
      String(tok.symbol ?? "").toUpperCase(),
    );
    cap.total += usd;
    cap[key] += usd;
  }
  return cap;
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

  const fromFeed = [...items]
    .filter((t) => (priceMap[t.address.toLowerCase()] ?? 0) > 0)
    .sort((a, b) => (b.marketCap ?? b.interest ?? 0) - (a.marketCap ?? a.interest ?? 0));

  const pricedCount = new Set([
    ...CURATED_TOKENS.filter((t) => (priceMap[t.address.toLowerCase()] ?? 0) > 0).map((t) =>
      t.address.toLowerCase(),
    ),
    ...fromFeed.map((t) => t.address.toLowerCase()),
  ]).size;
  const scanLimit = Math.min(SCAN_TOKENS_MAX, Math.max(SCAN_TOKENS, pricedCount));

  const scanList: TokenFeed[] = [];
  for (const t of CURATED_TOKENS) {
    const addr = t.address.toLowerCase();
    const price = priceMap[addr] ?? 0;
    if (!(price > 0)) continue;
    if (scanList.length >= scanLimit) break;
    scanList.push({
      address: t.address,
      symbol: "",
      category: t.category,
      price,
      marketCap: null,
    });
  }
  for (const t of fromFeed) {
    if (scanList.length >= scanLimit) break;
    if (scanList.some((x) => x.address.toLowerCase() === t.address.toLowerCase())) continue;
    scanList.push(t);
  }

  const feedMap = new Map<string, string>();
  for (const t of items) {
    if (t.category) feedMap.set(t.address.toLowerCase(), String(t.category));
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
      await sleep(250);
    }

    const holders = await holdersForToken(arc, token.address, decimals);
    await sleep(250);
    const key = bucket(
      tokenAddr,
      String(token.category ?? ""),
      String(token.symbol ?? "").toUpperCase(),
    );
    const isUsdc = tokenAddr === USDC;

    for (const h of holders) {
      const usd = h.amount * price;
      if (!(usd > 0)) continue;
      const prev = capital.get(h.addr) ?? { total: 0, stable: 0, defi: 0, tokens: 0, usdc: 0 };
      prev.total += usd;
      prev[key] += usd;
      if (isUsdc) prev.usdc += usd;
      capital.set(h.addr, prev);
    }
  }

  const ranked = [...capital.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, TOP_N);

  const network = await arc.stats().catch(() => null as Record<string, unknown> | null);
  const networkTxs24h = Number(network?.transactions_today ?? 0);

  const wallets: WalletRow[] = [];
  for (let i = 0; i < ranked.length; i++) {
    const [addr, rough] = ranked[i];
    let txsTotal = 0;
    let txs24h = 0;
    let name: string | undefined;
    let cap = { ...rough };

    if (i < VALUE_N) {
      const [valued, counters, profile, recent] = await Promise.all([
        valuePortfolio(arc, addr, priceMap, feedMap),
        arc.addressCounters(addr).catch(() => null),
        arc.address(addr).catch(() => null),
        arc.addressTransactions(addr).catch(() => ({ items: [] })),
      ]);
      await sleep(280);

      if (valued.total > 0) {
        cap = {
          total: valued.total,
          stable: valued.stable,
          defi: valued.defi,
          tokens: valued.tokens,
          usdc: valued.usdc,
        };
      } else if (valued.native > 0) {
        const usdcTok = rough.usdc ?? 0;
        cap = {
          total: rough.total - usdcTok + valued.native,
          stable: rough.stable - usdcTok + valued.native,
          defi: rough.defi,
          tokens: rough.tokens,
          usdc: valued.native,
        };
      }

      txsTotal = Number(counters?.transactions_count ?? 0);
      name = profile?.name
        ? String(profile.name)
        : profile?.ens_domain_name
          ? String(profile.ens_domain_name)
          : undefined;

      const dayAgo = Date.now() - DAY_MS;
      for (const tx of recent.items ?? []) {
        const ts = tx.timestamp != null ? new Date(String(tx.timestamp)).getTime() : 0;
        if (ts >= dayAgo) txs24h += 1;
      }
    }

    const netWorth = cap.total;
    wallets.push({
      address: addr,
      name,
      label: inferLabel(netWorth, txsTotal),
      netWorth,
      change24h: null,
      change7d: null,
      txs24h,
      txsTotal,
      lastActive: null,
      spark24h: [netWorth],
      spark7d: [netWorth],
      breakdown: {
        stable: cap.stable,
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
    txs24h: networkTxs24h,
    netFlow24h: 0,
    avgAgeDays: 0,
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
  return {
    ok: true,
    count: wallets.length,
    totalValue,
    top10Value,
    txs24h: stats.txs24h,
    updatedAt,
  };
}

export async function maybeIngestWallets(env: Env, arc: Arcscan, minAgeMs = 30 * 60_000) {
  const last = Number((await getMeta(env, "last_wallets_ingest")) ?? "0") || 0;
  if (Date.now() - last < minAgeMs) return { skipped: true, last };
  return ingestWallets(env, arc);
}
