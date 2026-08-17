export type WatchKind = "token" | "protocol" | "wallet" | "contract";

export type WatchEntry = {
  id: string;
  kind: WatchKind;
  list: string;
  addedAt: number;
};

const KEY = "arclytics:watchlist-v1";
const TOKEN = "arclytics:watch-token:";
const PROTO = "arclytics:watch:";
const ADDR = "arclytics:watch-address:";
const WALLETS = "arclytics:wallet-watchlist";
const NFTS = "arclytics:nft-watchlist";
const LISTS = "arclytics:watch-lists";
const BASE_LISTS = ["Assets", "DeFi", "Whales", "Infra", "Watch Later"];

export const LIST_DOT: Record<string, string> = {
  Assets: "bg-sky-500",
  DeFi: "bg-violet-500",
  Whales: "bg-emerald-500",
  Infra: "bg-amber-500",
  "Watch Later": "bg-ink-400",
};

export const DEFAULT_LIST: Record<WatchKind, string> = {
  token: "Assets",
  protocol: "DeFi",
  wallet: "Whales",
  contract: "Infra",
};

export const KIND_PILL: Record<WatchKind, string> = {
  token: "bg-sky-50 text-sky-700",
  protocol: "bg-violet-50 text-violet-700",
  wallet: "bg-emerald-50 text-emerald-700",
  contract: "bg-orange-50 text-orange-700",
};

export const KIND_LABEL: Record<WatchKind, string> = {
  token: "Token",
  protocol: "Protocol",
  wallet: "Wallet",
  contract: "Contract",
};

function ping() {
  window.dispatchEvent(new Event("arc-watch"));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
}

function migrate(): WatchEntry[] {
  const items: WatchEntry[] = [];
  const seen = new Set<string>();
  const add = (id: string, kind: WatchKind) => {
    const k = `${kind}:${id}`;
    if (!id || seen.has(k)) return;
    seen.add(k);
    items.push({ id, kind, list: DEFAULT_LIST[kind], addedAt: Date.now() });
  };
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || localStorage.getItem(key) !== "1") continue;
    if (key.startsWith(TOKEN)) add(key.slice(TOKEN.length), "token");
    else if (key.startsWith(ADDR)) add(key.slice(ADDR.length), "wallet");
    else if (key.startsWith(PROTO)) add(key.slice(PROTO.length), "protocol");
  }
  for (const a of readJson<string[]>(WALLETS, [])) add(a.toLowerCase(), "wallet");
  for (const a of readJson<string[]>(NFTS, [])) add(a.toLowerCase(), "contract");
  return items;
}

export function readWatchlist(): WatchEntry[] {
  const saved = readJson<WatchEntry[] | null>(KEY, null);
  if (saved?.length) return saved;
  const migrated = migrate();
  if (migrated.length) localStorage.setItem(KEY, JSON.stringify(migrated));
  return migrated;
}

function persist(items: WatchEntry[]) {
  localStorage.setItem(KEY, JSON.stringify(items));
  localStorage.setItem(WALLETS, JSON.stringify(items.filter((i) => i.kind === "wallet").map((i) => i.id)));
  localStorage.setItem(NFTS, JSON.stringify(items.filter((i) => i.kind === "contract").map((i) => i.id)));
  for (const i of items) {
    if (i.kind === "token") localStorage.setItem(TOKEN + i.id, "1");
    if (i.kind === "protocol") localStorage.setItem(PROTO + i.id, "1");
    if (i.kind === "wallet") localStorage.setItem(ADDR + i.id, "1");
  }
  ping();
}

export function isWatched(kind: WatchKind, id: string) {
  const k = id.toLowerCase();
  return readWatchlist().some((i) => i.kind === kind && i.id.toLowerCase() === k);
}

export function addWatch(kind: WatchKind, id: string, list = DEFAULT_LIST[kind]) {
  const nid = kind === "protocol" ? id : id.toLowerCase();
  const items = readWatchlist();
  if (items.some((i) => i.kind === kind && i.id === nid)) return items;
  const next = [...items, { id: nid, kind, list, addedAt: Date.now() }];
  persist(next);
  return next;
}

export function removeWatch(kind: WatchKind, id: string) {
  const k = id.toLowerCase();
  const items = readWatchlist().filter((i) => !(i.kind === kind && i.id.toLowerCase() === k));
  if (kind === "token") localStorage.removeItem(TOKEN + k);
  if (kind === "protocol") localStorage.removeItem(PROTO + id);
  if (kind === "wallet") localStorage.removeItem(ADDR + k);
  persist(items);
  return items;
}

export function toggleWatch(kind: WatchKind, id: string) {
  return isWatched(kind, id) ? removeWatch(kind, id) : addWatch(kind, id);
}

export function setWatchList(kind: WatchKind, id: string, list: string) {
  const k = id.toLowerCase();
  const next = readWatchlist().map((i) =>
    i.kind === kind && i.id.toLowerCase() === k ? { ...i, list } : i,
  );
  persist(next);
  return next;
}

export function subscribeWatch(fn: () => void) {
  window.addEventListener("arc-watch", fn);
  return () => window.removeEventListener("arc-watch", fn);
}

export function readLists(): string[] {
  const extra = readJson<string[]>(LISTS, []);
  return [...new Set([...BASE_LISTS, ...extra, ...readWatchlist().map((i) => i.list)])];
}

export function addList(name: string) {
  const n = name.trim();
  if (!n) return readLists();
  const extra = readJson<string[]>(LISTS, []);
  if (!BASE_LISTS.includes(n) && !extra.includes(n)) {
    localStorage.setItem(LISTS, JSON.stringify([...extra, n]));
  }
  ping();
  return readLists();
}
