import { addresses, RESERVE_USD } from "@arclytics/chain";
import { getTokens } from "@/libs/api";
import { arcscan } from "@/libs/arcscan";
import { fetchCache } from "@/libs/queryCache";

export type AddressToken = {
  address: string;
  name: string;
  symbol: string;
  balance: number;
  valueUsd: number;
  price: number | null;
  iconUrl?: string;
  type: string;
};

export type AddressNft = {
  address: string;
  name: string;
  symbol: string;
  count: number;
  iconUrl?: string;
};

export type AddressTx = {
  hash: string;
  method: string;
  block: number | null;
  timestamp: string | null;
  from: string;
  to: string;
  valueUsdc: number;
  feeUsdc: number;
  ok: boolean | null;
  direction: "in" | "out" | "self";
  tokenSymbol: string;
};

export type AddressProfile = {
  address: string;
  name?: string;
  ens?: string;
  isContract: boolean;
  isVerified: boolean;
  nativeUsdc: number;
  txCount: number;
  tokenTransferCount: number;
  gasUsed: number;
};

export type AddressDetail = AddressProfile & {
  tokenValueUsd: number;
  tokenCount: number;
  nftCount: number;
  tokens: AddressToken[];
  nfts: AddressNft[];
  txs: AddressTx[];
  transfers: AddressTx[];
  netWorth: number;
  balanceSeries: Array<{ date: string; value: number }>;
  portfolio: Array<{ label: string; value: number }>;
  lastActive: string | null;
  firstSeen: string | null;
};

function parseAmt(raw: unknown, decimals = 18) {
  const v = Number(raw ?? 0);
  const d = Number.isFinite(decimals) && decimals >= 0 && decimals <= 36 ? decimals : 18;
  return Number.isFinite(v) ? v / 10 ** d : 0;
}

function hashOf(obj: unknown) {
  if (!obj || typeof obj !== "object") return "";
  return String((obj as { hash?: string }).hash ?? "").toLowerCase();
}

function mapTx(item: Record<string, unknown>, self: string): AddressTx {
  const from = hashOf(item.from);
  const to = hashOf(item.to);
  const result = String(item.result ?? item.status ?? "");
  const ok =
    result === "success" || result === "ok"
      ? true
      : result === "error" || result === "failed"
        ? false
        : null;
  const direction =
    from === self && to === self ? "self" : from === self ? "out" : "in";
  const fee = (item.fee as { value?: string } | undefined)?.value;
  return {
    hash: String(item.hash ?? ""),
    method: String(item.method ?? "transfer"),
    block: item.block_number != null ? Number(item.block_number) : null,
    timestamp: item.timestamp != null ? String(item.timestamp) : null,
    from,
    to,
    valueUsdc: parseAmt(item.value),
    feeUsdc: parseAmt(fee),
    ok,
    direction,
    tokenSymbol: "USDC",
  };
}

const priceFeed = () =>
  fetchCache("ep:token-feed", () =>
    getTokens().catch(() => ({ items: [] as Awaited<ReturnType<typeof getTokens>>["items"] })),
  );

export async function loadAddressProfile(address: string): Promise<AddressProfile | null> {
  const addr = address.toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(addr)) return null;
  const [profile, counters] = await Promise.all([
    arcscan.address(addr).catch(() => null),
    arcscan.addressCounters(addr).catch(() => ({} as Record<string, string>)),
  ]);
  if (!profile) return null;
  return {
    address: String(profile.hash ?? addr).toLowerCase(),
    name: profile.name ? String(profile.name) : undefined,
    ens: profile.ens_domain_name ? String(profile.ens_domain_name) : undefined,
    isContract: Boolean(profile.is_contract),
    isVerified: Boolean(profile.is_verified),
    nativeUsdc: parseAmt(profile.coin_balance),
    txCount: Number(counters.transactions_count ?? 0),
    tokenTransferCount: Number(counters.token_transfers_count ?? 0),
    gasUsed: Number(counters.gas_usage_count ?? 0),
  };
}

export async function loadAddressTokenList(address: string): Promise<AddressToken[]> {
  const addr = address.toLowerCase();
  const [erc20, feed] = await Promise.all([
    arcscan.addressTokens(addr, "ERC-20").catch(() => ({ items: [] as Array<Record<string, unknown>> })),
    priceFeed(),
  ]);
  const priceMap: Record<string, number> = { ...RESERVE_USD };
  for (const t of feed.items ?? []) {
    if (t.price != null && t.price > 0) priceMap[t.address.toLowerCase()] = t.price;
  }
  const tokens: AddressToken[] = [];
  for (const row of erc20.items ?? []) {
    const tok = (row.token ?? {}) as Record<string, unknown>;
    const tokenAddr = String(tok.address_hash ?? "").toLowerCase();
    if (!tokenAddr) continue;
    const decimals = Number(tok.decimals ?? 18);
    const balance = parseAmt(row.value, decimals);
    if (!(balance > 0)) continue;
    const price =
      priceMap[tokenAddr] ??
      (tok.exchange_rate != null && Number(tok.exchange_rate) > 0
        ? Number(tok.exchange_rate)
        : null);
    tokens.push({
      address: tokenAddr,
      name: String(tok.name ?? ""),
      symbol: String(tok.symbol ?? ""),
      balance,
      valueUsd: price != null ? balance * price : 0,
      price,
      iconUrl: tok.icon_url ? String(tok.icon_url) : undefined,
      type: String(tok.type ?? "ERC-20"),
    });
  }
  return tokens.sort((a, b) => b.valueUsd - a.valueUsd || b.balance - a.balance);
}

export async function loadAddressNftList(address: string): Promise<AddressNft[]> {
  const erc721 = await arcscan
    .addressTokens(address.toLowerCase(), "ERC-721")
    .catch(() => ({ items: [] as Array<Record<string, unknown>> }));
  return (erc721.items ?? []).map((row) => {
    const tok = (row.token ?? {}) as Record<string, unknown>;
    return {
      address: String(tok.address_hash ?? "").toLowerCase(),
      name: String(tok.name ?? ""),
      symbol: String(tok.symbol ?? ""),
      count: Number(row.value ?? 0) || 1,
      iconUrl: tok.icon_url ? String(tok.icon_url) : undefined,
    };
  });
}

export async function loadAddressTxList(address: string): Promise<AddressTx[]> {
  const addr = address.toLowerCase();
  const page = await arcscan
    .addressTransactions(addr)
    .catch(() => ({ items: [] as Array<Record<string, unknown>> }));
  return (page.items ?? []).slice(0, 50).map((t) => mapTx(t, addr));
}

export async function loadAddressTransferList(address: string): Promise<AddressTx[]> {
  const addr = address.toLowerCase();
  const page = await arcscan
    .addressTokenTransfers(addr)
    .catch(() => ({ items: [] as Array<Record<string, unknown>> }));
  return (page.items ?? []).slice(0, 50).map((t) => {
    const token = (t.token as Record<string, unknown> | undefined) ?? {};
    const total = t.total as { value?: string } | string | undefined;
    const raw = typeof total === "object" && total ? total.value : total ?? t.value;
    const decimals = Number(token.decimals ?? 18);
    const base = mapTx(
      {
        ...t,
        hash: t.transaction_hash ?? t.tx_hash ?? t.hash,
        value: raw,
      },
      addr,
    );
    return {
      ...base,
      method: String(t.method ?? token.symbol ?? "transfer"),
      valueUsdc: parseAmt(raw, decimals),
      tokenSymbol: String(token.symbol ?? "TOKEN"),
    };
  });
}

export async function loadAddressBalanceSeries(
  address: string,
): Promise<Array<{ date: string; value: number }>> {
  const hist = await arcscan
    .coinBalanceHistoryByDay(address.toLowerCase())
    .catch(() => ({ items: [] as Array<{ date?: string; value?: string }> }));
  return (hist.items ?? [])
    .map((d) => ({
      date: String(d.date ?? ""),
      value: parseAmt(d.value),
    }))
    .filter((d) => d.date);
}

export function portfolioSlices(
  nativeUsdc: number,
  tokens: AddressToken[],
  nfts: AddressNft[],
): Array<{ label: string; value: number }> {
  const native = { label: "USDC", value: nativeUsdc };
  const top = tokens.slice(0, 4).map((t) => ({ label: t.symbol || "Token", value: t.valueUsd }));
  const used = new Set(top.map((t) => t.label));
  const rest = tokens.filter((t) => !used.has(t.symbol)).reduce((s, t) => s + t.valueUsd, 0);
  const out = [native, ...top];
  if (rest > 0) out.push({ label: "Other", value: rest });
  if (nfts.length) out.push({ label: "NFTs", value: nfts.length });
  return out.filter((s) => s.value > 0);
}

/** Combined loader for address detail page. */
export async function loadAddressDetail(address: string): Promise<AddressDetail | null> {
  const addr = address.toLowerCase();
  const [profile, tokens, nfts, txs, transfers, balanceSeries] = await Promise.all([
    loadAddressProfile(addr),
    loadAddressTokenList(addr),
    loadAddressNftList(addr),
    loadAddressTxList(addr),
    loadAddressTransferList(addr),
    loadAddressBalanceSeries(addr),
  ]);
  if (!profile) return null;

  const tokenValueUsd = tokens.reduce((s, t) => s + t.valueUsd, 0);
  const usdcAddr = addresses.usdc.toLowerCase();
  const usdcToken = tokens.find((t) => t.address === usdcAddr);
  const otherTokens = Math.max(0, tokenValueUsd - (usdcToken?.valueUsd ?? 0));
  const portfolio = [
    { label: "USDC", value: profile.nativeUsdc },
    { label: "Other tokens", value: otherTokens + (usdcToken?.valueUsd ?? 0) },
    { label: "NFTs", value: Math.max(nfts.length, 0) },
  ].filter((s) => s.value > 0);

  return {
    ...profile,
    tokenValueUsd,
    tokenCount: tokens.length,
    nftCount: nfts.length,
    tokens,
    nfts,
    txs,
    transfers,
    netWorth: profile.nativeUsdc + tokenValueUsd,
    balanceSeries,
    portfolio,
    lastActive: txs[0]?.timestamp ?? null,
    firstSeen: balanceSeries[0]?.date ? `${balanceSeries[0].date}T00:00:00.000Z` : null,
  };
}
