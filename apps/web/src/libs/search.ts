import { protocols } from "@arclytics/protocols";
import type { IconName } from "@/components/shared/Icons";
import { CATEGORY_LABELS } from "@/config/categories";
import { mainNav, toolsNav } from "@/config/nav";
import type { TokenFeedRow } from "@/libs/api";
import { paths } from "@/routes/paths";
import { shortHash } from "@/utils/format";

export const TOKENS_CACHE_KEY = "tokens-api-v3";
const ARCSCAN = "https://testnet.arcscan.app";
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const BLOCK_RE = /^\d{1,12}$/;

export type SearchKind = "protocol" | "token" | "page" | "address" | "tx" | "block";

export type SearchItem = {
  id: string;
  kind: SearchKind;
  title: string;
  subtitle?: string;
  href: string;
  external?: boolean;
  icon?: IconName;
  slug?: string;
  address?: string;
  iconUrl?: string | null;
  symbol?: string;
  category?: string;
  /** High-signal terms: slug, symbol, category, address. */
  keywords?: string;
  /** Low-signal prose: descriptions and blurbs. */
  text?: string;
  /** Matched slice of `title`, used to highlight the query. */
  range?: [number, number];
};

export type SearchGroup = { label?: string; items: SearchItem[] };

const KIND_LABEL: Record<SearchKind, string> = {
  protocol: "Protocols",
  token: "Tokens",
  page: "Pages",
  address: "Addresses",
  tx: "Transactions",
  block: "Blocks",
};

/** Nudges more specific entities above generic app pages on equal text match. */
const KIND_BOOST: Record<SearchKind, number> = {
  protocol: 40,
  token: 30,
  page: 20,
  address: 0,
  tx: 0,
  block: 0,
};

function page(href: string, title: string, icon: IconName, keywords = ""): SearchItem {
  return { id: `page:${href}`, kind: "page", title, subtitle: "Page", href, icon, keywords };
}

const NAV_KEYWORDS: Record<string, string> = {
  [paths.home]: "overview home stats kpi tvl",
  [paths.ecosystem]: "protocols dapps projects tvl",
  [paths.tokens]: "erc20 coins prices holders",
  [paths.nfts]: "erc721 collections collectibles",
  [paths.ask]: "ai assistant chat question",
  [paths.analytics]: "charts activity heatmap flows",
  [paths.explorer]: "transactions blocks addresses chain",
  [paths.walletTracker]: "portfolio wallets balances",
  [paths.compare]: "versus diff side by side",
  [paths.watchlist]: "favorites saved starred",
  [paths.settings]: "preferences theme appearance account",
};

const PAGE_ITEMS: SearchItem[] = [
  ...[...mainNav, ...toolsNav].map((n) => page(n.href, n.label, n.icon, NAV_KEYWORDS[n.href])),
  page(paths.rankings, "Rankings", "Rankings", "leaderboard top protocols tvl"),
  page(paths.tokensMarketCap, "Token Market Cap", "Tokens", "mcap valuation supply"),
  page(paths.contracts, "Contracts", "Contracts", "verified source code"),
  page(paths.blocks, "Blocks", "Blocks", "latest height validators"),
  page(paths.transactions, "Transactions", "Tx", "txs latest activity"),
  page(paths.addresses, "Top Addresses", "Users", "accounts holders richest"),
  page(paths.apiDocs, "API Docs", "Docs", "developers endpoints reference"),
  page(paths.about, "About", "Info", "arclytics team info"),
];

const PROTOCOL_ITEMS: SearchItem[] = protocols.map((p) => ({
  id: `protocol:${p.slug}`,
  kind: "protocol",
  title: p.name,
  subtitle: CATEGORY_LABELS[p.category] ?? p.category,
  href: paths.protocol(p.slug),
  slug: p.slug,
  category: p.category,
  keywords: [p.slug, p.category, ...p.contracts.map((c) => c.label ?? "")].join(" ").trim(),
  text: p.description ?? "",
}));

export function buildTokenItems(rows: TokenFeedRow[]): SearchItem[] {
  return rows.map((t) => ({
    id: `token:${t.address}`,
    kind: "token" as const,
    title: t.symbol || t.name || shortHash(t.address),
    subtitle: t.name && t.name !== t.symbol ? t.name : t.protocol || "Token",
    href: paths.token(t.address),
    address: t.address,
    iconUrl: t.iconUrl ?? null,
    symbol: t.symbol,
    keywords: [t.name, t.symbol, t.protocol, t.category, t.address].filter(Boolean).join(" "),
    text: t.blurb ?? "",
  }));
}

/** Gap count for `query` as a subsequence of `text`, or null when absent. */
function subsequenceGaps(text: string, query: string): number | null {
  let from = 0;
  let gaps = 0;
  let prev = -1;
  for (let i = 0; i < query.length; i++) {
    const at = text.indexOf(query[i], from);
    if (at === -1) return null;
    if (prev >= 0) gaps += at - prev - 1;
    prev = at;
    from = at + 1;
  }
  return gaps;
}

type Match = { score: number; range?: [number, number] };

function matchItem(item: SearchItem, q: string): Match | null {
  const title = item.title.toLowerCase();
  if (title === q) return { score: 1000, range: [0, q.length] };

  const at = title.indexOf(q);
  if (at === 0) return { score: 900 - title.length, range: [0, q.length] };
  if (at > 0) {
    const atWordStart = !/[a-z0-9]/.test(title[at - 1]);
    return { score: (atWordStart ? 780 : 640) - title.length, range: [at, at + q.length] };
  }

  const keywords = `${item.subtitle ?? ""} ${item.keywords ?? ""}`.toLowerCase();
  const keywordAt = keywords.indexOf(q);
  if (keywordAt === 0) return { score: 520 };
  if (keywordAt > 0) return { score: 460 };

  if (q.length >= 3) {
    const gaps = subsequenceGaps(title, q);
    if (gaps !== null) return { score: Math.max(200, 400 - gaps * 12) };
    if (item.text && item.text.toLowerCase().includes(q)) return { score: 150 };
  }

  return null;
}

export function searchIndex(query: string, tokenRows: TokenFeedRow[] = [], limit = 12) {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const scored: Array<{ item: SearchItem; match: Match; rank: number }> = [];
  for (const item of [...PROTOCOL_ITEMS, ...buildTokenItems(tokenRows), ...PAGE_ITEMS]) {
    const match = matchItem(item, q);
    if (match) scored.push({ item, match, rank: match.score + KIND_BOOST[item.kind] });
  }

  scored.sort((a, b) => b.rank - a.rank || a.item.title.length - b.item.title.length);
  return scored.slice(0, limit).map(({ item, match }) => ({ ...item, range: match.range }));
}

/** Exact address / tx hash / block number the user can open directly. */
export function jumpItem(query: string): SearchItem | null {
  const q = query.trim();

  if (ADDRESS_RE.test(q)) {
    const address = q.toLowerCase();
    return {
      id: `jump:${address}`,
      kind: "address",
      title: shortHash(q, 12, 10),
      subtitle: "Open address",
      href: paths.address(address),
      icon: "Users",
      address,
    };
  }

  if (TX_HASH_RE.test(q)) {
    return {
      id: `jump:${q}`,
      kind: "tx",
      title: shortHash(q, 12, 10),
      subtitle: "Open transaction on ArcScan",
      href: `${ARCSCAN}/tx/${q}`,
      external: true,
      icon: "Tx",
    };
  }

  if (BLOCK_RE.test(q)) {
    return {
      id: `jump:block:${q}`,
      kind: "block",
      title: `Block #${Number(q).toLocaleString()}`,
      subtitle: "Open block on ArcScan",
      href: `${ARCSCAN}/block/${q}`,
      external: true,
      icon: "Blocks",
    };
  }

  return null;
}

/** Maps ArcScan quick-search rows, skipping anything already matched locally. */
export function remoteItems(
  rows: Array<Record<string, unknown>>,
  seen: Set<string>,
  limit = 6,
): SearchItem[] {
  const out: SearchItem[] = [];

  for (const r of rows) {
    if (out.length >= limit) break;
    const type = String(r.type ?? "");
    const address = String(r.address ?? r.address_hash ?? "");
    const name = String(r.name ?? "");
    const symbol = String(r.symbol ?? "");
    const key = address.toLowerCase();

    if (type === "token" && address) {
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `remote:token:${key}`,
        kind: "token",
        title: symbol || name || shortHash(address),
        subtitle: name && name !== symbol ? name : "Token",
        href: paths.token(address),
        address,
        symbol,
        iconUrl: typeof r.icon_url === "string" ? r.icon_url : null,
      });
      continue;
    }

    if ((type === "address" || type === "contract") && address) {
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        id: `remote:address:${key}`,
        kind: "address",
        title: name || shortHash(address, 10, 8),
        subtitle: type === "contract" ? "Contract" : "Address",
        href: paths.address(address),
        icon: type === "contract" ? "Contracts" : "Users",
        address,
      });
      continue;
    }

    if (type === "transaction") {
      const hash = String(r.transaction_hash ?? r.hash ?? "");
      if (!hash || seen.has(hash.toLowerCase())) continue;
      seen.add(hash.toLowerCase());
      out.push({
        id: `remote:tx:${hash}`,
        kind: "tx",
        title: shortHash(hash, 10, 8),
        subtitle: "Transaction",
        href: `${ARCSCAN}/tx/${hash}`,
        external: true,
        icon: "Tx",
      });
      continue;
    }

    if (type === "block") {
      const height = String(r.block_number ?? r.height ?? "");
      if (!height || seen.has(`block:${height}`)) continue;
      seen.add(`block:${height}`);
      out.push({
        id: `remote:block:${height}`,
        kind: "block",
        title: `Block #${height}`,
        subtitle: "Block",
        href: `${ARCSCAN}/block/${height}`,
        external: true,
        icon: "Blocks",
      });
    }
  }

  return out;
}

/** Groups by kind, keeping groups in best-match-first order from `items`. */
export function groupItems(items: SearchItem[], perGroup = Number.POSITIVE_INFINITY): SearchGroup[] {
  const buckets = new Map<SearchKind, SearchItem[]>();
  for (const item of items) {
    const list = buckets.get(item.kind);
    if (list) list.push(item);
    else buckets.set(item.kind, [item]);
  }
  return [...buckets].map(([kind, list]) => ({
    label: KIND_LABEL[kind],
    items: list.slice(0, perGroup),
  }));
}

export function addressKeys(items: SearchItem[]): Set<string> {
  const seen = new Set<string>();
  for (const item of items) if (item.address) seen.add(item.address.toLowerCase());
  return seen;
}

const RECENT_KEY = "arclytics.recentSearches";
const RECENT_MAX = 5;

export function readRecents(): SearchItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as SearchItem[]).slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: SearchItem) {
  const { range: _range, ...entry } = item;
  try {
    const next = [entry, ...readRecents().filter((r) => r.href !== entry.href)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
}

export function clearRecents() {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    /* storage unavailable */
  }
}
