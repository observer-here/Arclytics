import { authFetch, loginWithMagic, sessionToken } from "./auth";

export type WatchKind = "token" | "protocol" | "wallet" | "contract";

export type WatchEntry = {
  id: string;
  kind: WatchKind;
  list: string;
  addedAt: number;
};

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

const BASE_LISTS = ["Assets", "DeFi", "Whales", "Infra", "Watch Later"];

let items: WatchEntry[] = [];
let lists: string[] = [...BASE_LISTS];

function ping() {
  window.dispatchEvent(new Event("arc-watch"));
}

function apply(data: { items?: WatchEntry[]; lists?: string[] }) {
  items = data.items ?? [];
  lists = data.lists?.length ? data.lists : [...BASE_LISTS];
  ping();
}

function nid(_kind: WatchKind, id: string) {
  return id.toLowerCase();
}

async function requireAuth() {
  if (sessionToken()) return true;
  try {
    await loginWithMagic();
    await loadWatchlist();
  } catch {
    return false;
  }
  return !!sessionToken();
}

export function readWatchlist(): WatchEntry[] {
  return items;
}

export function isWatched(kind: WatchKind, id: string) {
  const k = nid(kind, id);
  return items.some((i) => i.kind === kind && i.id.toLowerCase() === k.toLowerCase());
}

export function readLists(): string[] {
  return [...new Set([...BASE_LISTS, ...lists, ...items.map((i) => i.list)])];
}

export async function loadWatchlist() {
  if (!sessionToken()) {
    apply({ items: [], lists: BASE_LISTS });
    return;
  }
  try {
    apply(await authFetch("/v1/watchlist"));
  } catch {
    apply({ items: [], lists: BASE_LISTS });
  }
}

export async function addWatch(kind: WatchKind, id: string, list = DEFAULT_LIST[kind]) {
  if (!(await requireAuth())) return items;
  const itemId = nid(kind, id);
  if (items.some((i) => i.kind === kind && i.id.toLowerCase() === itemId.toLowerCase())) return items;
  apply({
    items: [...items, { id: itemId, kind, list, addedAt: Date.now() }],
    lists,
  });
  try {
    apply(await authFetch("/v1/watchlist", { method: "POST", body: JSON.stringify({ kind, id: itemId, list }) }));
  } catch {
    await loadWatchlist();
  }
  return items;
}

export async function removeWatch(kind: WatchKind, id: string) {
  if (!(await requireAuth())) return items;
  const itemId = nid(kind, id);
  apply({
    items: items.filter((i) => !(i.kind === kind && i.id.toLowerCase() === itemId.toLowerCase())),
    lists,
  });
  try {
    apply(
      await authFetch(`/v1/watchlist?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
      }),
    );
  } catch {
    await loadWatchlist();
  }
  return items;
}

export async function toggleWatch(kind: WatchKind, id: string) {
  return isWatched(kind, id) ? removeWatch(kind, id) : addWatch(kind, id);
}

export async function setWatchList(kind: WatchKind, id: string, list: string) {
  if (!(await requireAuth())) return items;
  const itemId = nid(kind, id);
  apply({
    items: items.map((i) => (i.kind === kind && i.id.toLowerCase() === itemId.toLowerCase() ? { ...i, list } : i)),
    lists,
  });
  try {
    apply(await authFetch("/v1/watchlist", { method: "PATCH", body: JSON.stringify({ kind, id: itemId, list }) }));
  } catch {
    await loadWatchlist();
  }
  return items;
}

export async function addList(name: string) {
  if (!(await requireAuth())) return readLists();
  const n = name.trim();
  if (!n) return readLists();
  try {
    apply(await authFetch("/v1/watchlist/lists", { method: "POST", body: JSON.stringify({ name: n }) }));
  } catch {
    await loadWatchlist();
  }
  return readLists();
}

export function subscribeWatch(fn: () => void) {
  window.addEventListener("arc-watch", fn);
  return () => window.removeEventListener("arc-watch", fn);
}
