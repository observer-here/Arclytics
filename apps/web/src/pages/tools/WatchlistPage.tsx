import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Icons } from "@/components/shared/Icons";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useAuth } from "@/hooks/useAuth";
import { getProtocolRankings, getTokens, getWallets } from "@/libs/api";
import { loginWithMagic } from "@/libs/auth";
import { loadNftDashboard } from "@/libs/nfts";
import {
  addList,
  addWatch,
  isWatched,
  KIND_LABEL,
  KIND_PILL,
  LIST_DOT,
  readLists,
  readWatchlist,
  removeWatch,
  subscribeWatch,
  type WatchEntry,
  type WatchKind,
} from "@/libs/watchlist";
import { paths } from "@/routes/paths";
import { usd } from "@/utils/format";

const PAGE = 6;
const KINDS: WatchKind[] = ["token", "protocol", "wallet", "contract"];

type Row = WatchEntry & {
  name: string;
  sub: string;
  href: string;
  price: number | null;
  change: number | null;
  market: number | null;
  spark: number[];
  icon?: string;
};

function MiniSpark({ series, up }: { series: number[]; up: boolean }) {
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1;
  const line = series
    .map((v, i) => `${(i / (series.length - 1)) * 48},${16 - ((v - min) / span) * 12}`)
    .join(" ");
  return (
    <svg width="52" height="18" viewBox="0 0 52 18" className="shrink-0">
      <polyline fill="none" stroke={up ? "#10b981" : "#f43f5e"} strokeWidth="1.5" points={line} />
    </svg>
  );
}

function fmtDay(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtShort(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WatchlistPage() {
  const user = useAuth();
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<WatchEntry[]>(readWatchlist);
  const [tab, setTab] = useState<"all" | WatchKind>("all");
  const [list, setList] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"list" | "grid">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [addKind, setAddKind] = useState<WatchKind>("token");
  const [addQ, setAddQ] = useState("");
  const [menu, setMenu] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newList, setNewList] = useState("");
  const [listNames, setListNames] = useState(readLists);

  useEffect(
    () =>
      subscribeWatch(() => {
        setEntries(readWatchlist());
        setListNames(readLists());
      }),
    [],
  );

  const { data } = useAsyncData("watchlist-feeds", async () => {
    const [tokens, protocols, wallets, nfts] = await Promise.all([
      getTokens().catch(() => ({ items: [] })),
      getProtocolRankings().catch(() => []),
      getWallets().catch(() => ({ items: [] })),
      loadNftDashboard().catch(() => null),
    ]);
    return { tokens: tokens.items ?? [], protocols, wallets: wallets.items ?? [], nfts: nfts?.collections ?? [] };
  });

  const rows: Row[] = useMemo(() => {
    const tokens = data?.tokens ?? [];
    const protocols = data?.protocols ?? [];
    const wallets = data?.wallets ?? [];
    const nfts = data?.nfts ?? [];
    return entries.map((e) => {
      if (e.kind === "token") {
        const t = tokens.find((x) => x.address.toLowerCase() === e.id);
        return {
          ...e,
          name: t?.symbol || t?.name || e.id.slice(0, 8),
          sub: t?.name || "Token",
          href: paths.token(e.id),
          price: t?.price ?? null,
          change: t?.change24h ?? null,
          market: t?.marketCap ?? null,
          spark: t?.change24h != null ? [0, t.change24h] : [],
          icon: t?.iconUrl,
        };
      }
      if (e.kind === "protocol") {
        const p = protocols.find((x) => x.slug === e.id);
        return {
          ...e,
          name: p?.name || e.id,
          sub: p?.category || "Protocol",
          href: paths.protocol(e.id),
          price: p?.tvlUsd ?? null,
          change: p?.change24h ?? null,
          market: p?.tvlUsd ?? null,
          spark: p?.spark7d ?? [],
        };
      }
      if (e.kind === "wallet") {
        const w = wallets.find((x) => x.address.toLowerCase() === e.id);
        return {
          ...e,
          name: w?.name || w?.label || `${e.id.slice(0, 6)}…${e.id.slice(-4)}`,
          sub: w?.label || "Wallet",
          href: paths.address(e.id),
          price: w?.netWorth ?? null,
          change: w?.change24h ?? null,
          market: w?.netWorth ?? null,
          spark: w?.spark24h ?? [],
        };
      }
      const n = nfts.find((x) => x.address === e.id);
      return {
        ...e,
        name: n?.name || n?.symbol || `${e.id.slice(0, 6)}…${e.id.slice(-4)}`,
        sub: n?.symbol || "Contract",
        href: paths.address(e.id),
        price: null,
        change: null,
        market: n?.holders ?? null,
        spark: [],
        icon: n?.iconUrl,
      };
    });
  }, [entries, data]);

  const lists = useMemo(
    () => listNames.map((id) => ({ id, count: entries.filter((e) => e.list === id).length, dot: LIST_DOT[id] ?? "bg-indigo-400" })),
    [entries, listNames],
  );

  const filtered = useMemo(() => {
    let listRows = rows;
    if (tab !== "all") listRows = listRows.filter((r) => r.kind === tab);
    if (list !== "all") listRows = listRows.filter((r) => r.list === list);
    const s = q.trim().toLowerCase();
    if (s) listRows = listRows.filter((r) => r.name.toLowerCase().includes(s) || r.sub.toLowerCase().includes(s) || r.id.includes(s));
    return listRows;
  }, [rows, tab, list, q]);

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const pageRows = filtered.slice((page - 1) * PAGE, page * PAGE);
  const recent = [...rows].sort((a, b) => b.addedAt - a.addedAt).slice(0, 5);

  const counts = {
    all: entries.length,
    token: entries.filter((e) => e.kind === "token").length,
    protocol: entries.filter((e) => e.kind === "protocol").length,
    wallet: entries.filter((e) => e.kind === "wallet").length,
    contract: entries.filter((e) => e.kind === "contract").length,
  };

  const addHits = useMemo(() => {
    const s = addQ.trim().toLowerCase();
    if (addKind === "token") {
      return (data?.tokens ?? [])
        .filter((t) => !s || t.name.toLowerCase().includes(s) || t.symbol.toLowerCase().includes(s) || t.address.includes(s))
        .slice(0, 6)
        .map((t) => ({ id: t.address, label: t.symbol, sub: t.name }));
    }
    if (addKind === "protocol") {
      return (data?.protocols ?? [])
        .filter((p) => !s || p.name.toLowerCase().includes(s) || p.slug.includes(s))
        .slice(0, 6)
        .map((p) => ({ id: p.slug, label: p.name, sub: p.category }));
    }
    if (addKind === "wallet") {
      return (data?.wallets ?? [])
        .filter((w) => !s || w.address.includes(s) || (w.name ?? "").toLowerCase().includes(s) || w.label.toLowerCase().includes(s))
        .slice(0, 6)
        .map((w) => ({ id: w.address, label: w.name || w.label, sub: w.address.slice(0, 10) }));
    }
    return (data?.nfts ?? [])
      .filter((n) => !s || n.name.toLowerCase().includes(s) || n.symbol.toLowerCase().includes(s) || n.address.includes(s))
      .slice(0, 6)
      .map((n) => ({ id: n.address, label: n.name, sub: n.symbol }));
  }, [addKind, addQ, data]);

  function add(kind: WatchKind, id: string) {
    void addWatch(kind, id);
    setAddOpen(false);
    setAddQ("");
  }

  function drop(kind: WatchKind, id: string) {
    void removeWatch(kind, id);
    setMenu(null);
  }

  async function signIn() {
    if (busy) return;
    setBusy(true);
    try {
      await loginWithMagic();
    } catch {
      /* cancelled */
    } finally {
      setBusy(false);
    }
  }

  const chips: Array<{ id: "all" | WatchKind; label: string; n: number }> = [
    { id: "all", label: "All", n: counts.all },
    { id: "token", label: "Tokens", n: counts.token },
    { id: "protocol", label: "Protocols", n: counts.protocol },
    { id: "wallet", label: "Wallets", n: counts.wallet },
    { id: "contract", label: "Contracts", n: counts.contract },
  ];

  if (!user) {
    return (
      <div>
        <h1 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
          <Icons.Watchlist size={16} className="text-arc-600" />
          Watchlist
        </h1>
        <p className="mt-1 text-[13px] text-ink-500">Sign in to save tokens, protocols, wallets and contracts to your account.</p>
        <button
          type="button"
          onClick={() => void signIn()}
          disabled={busy}
          className="mt-3 rounded-lg bg-gradient-to-r from-arc-600 to-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setTab(c.id);
              setPage(1);
            }}
            className={`rounded-full px-3 py-1 text-[12px] ${
              tab === c.id ? "bg-arc-600 font-medium text-white" : "border border-ink-200 bg-white text-ink-600 hover:bg-ink-50"
            }`}
          >
            {c.label} {c.n}
          </button>
        ))}
        <div className="relative ml-auto flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => document.getElementById("watch-lists")?.scrollIntoView({ behavior: "smooth" })}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:bg-ink-50"
          >
            <Icons.List size={13} />
            Manage Lists
          </button>
          <button
            type="button"
            onClick={() => setAddOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-arc-600 to-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white"
          >
            + Add to Watchlist
            <Icons.Chevron size={12} />
          </button>
          {addOpen ? (
            <div className="absolute right-0 top-9 z-20 w-72 rounded-xl border border-ink-200 bg-white p-2 shadow-card">
              <div className="mb-2 flex gap-1">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAddKind(k)}
                    className={`rounded-md px-2 py-1 text-[11px] ${addKind === k ? "bg-arc-50 font-medium text-arc-700" : "text-ink-500 hover:bg-ink-50"}`}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <input
                value={addQ}
                onChange={(e) => setAddQ(e.target.value)}
                placeholder={`Search ${KIND_LABEL[addKind].toLowerCase()}s…`}
                className="mb-1 w-full rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-[12px] outline-none ring-arc-500 focus:bg-white focus:ring-1"
              />
              <div className="max-h-52 overflow-auto">
                {addHits.map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    disabled={isWatched(addKind, h.id)}
                    onClick={() => add(addKind, h.id)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-ink-50 disabled:opacity-40"
                  >
                    <span>
                      <span className="block text-[12px] font-medium text-ink-800">{h.label}</span>
                      <span className="block text-[11px] text-ink-400">{h.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-ink-200 bg-white">
          <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-3 py-2">
            <div className="relative min-w-[180px] flex-1">
              <Icons.Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search in watchlist..."
                className="w-full rounded-lg border border-ink-200 bg-ink-50 py-1.5 pl-8 pr-2 text-[12px] outline-none ring-arc-500 focus:bg-white focus:ring-1"
              />
            </div>
            <select
              value={tab}
              onChange={(e) => {
                setTab(e.target.value as "all" | WatchKind);
                setPage(1);
              }}
              className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-[12px] text-ink-700"
            >
              <option value="all">All Types</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}s
                </option>
              ))}
            </select>
            <select
              value={list}
              onChange={(e) => {
                setList(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-[12px] text-ink-700"
            >
              <option value="all">All Lists</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.id}
                </option>
              ))}
            </select>
            <div className="ml-auto flex gap-1">
              <button
                type="button"
                onClick={() => setView("list")}
                className={`grid h-8 w-8 place-items-center rounded-lg ${view === "list" ? "bg-arc-50 text-arc-600" : "text-ink-400 hover:bg-ink-50"}`}
                aria-label="List view"
              >
                <Icons.List size={14} />
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                className={`grid h-8 w-8 place-items-center rounded-lg ${view === "grid" ? "bg-arc-50 text-arc-600" : "text-ink-400 hover:bg-ink-50"}`}
                aria-label="Grid view"
              >
                <Icons.Grid size={14} />
              </button>
            </div>
          </div>

          {view === "grid" ? (
            pageRows.length ? (
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {pageRows.map((r) => (
                  <Link key={`${r.kind}:${r.id}`} to={r.href} className="rounded-lg border border-ink-100 p-3 hover:bg-ink-50">
                    <RowName r={r} />
                    <div className="mt-2 flex items-center justify-between text-[12px]">
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${KIND_PILL[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                      <Change n={r.change} />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="px-3 py-10 text-center text-[13px] text-ink-400">Nothing in this watchlist yet. Use Add to Watchlist.</p>
            )
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60 text-[11px] font-medium text-ink-400">
                    <th className="px-3 py-2.5">Name</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">List</th>
                    <th className="px-3 py-2.5 text-right">Price / Value</th>
                    <th className="px-3 py-2.5 text-right">24h Change</th>
                    <th className="px-3 py-2.5 text-right">Market / TVL</th>
                    <th className="px-3 py-2.5">Added On</th>
                    <th className="w-8 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length ? (
                    pageRows.map((r) => {
                      const key = `${r.kind}:${r.id}`;
                      const up = (r.change ?? 0) >= 0;
                      return (
                        <tr key={key} className="border-t border-ink-100 hover:bg-ink-50/50">
                          <td className="px-3 py-2.5">
                            <Link to={r.href} className="hover:text-arc-700">
                              <RowName r={r} />
                            </Link>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${KIND_PILL[r.kind]}`}>{KIND_LABEL[r.kind]}</span>
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-700">
                              <span className={`h-1.5 w-1.5 rounded-full ${LIST_DOT[r.list] ?? "bg-indigo-400"}`} />
                              {r.list}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-medium text-ink-800">{r.price != null ? usd(r.price) : "—"}</td>
                          <td className="px-3 py-2.5">
                            <span className="flex items-center justify-end gap-2">
                              <Change n={r.change} />
                              <MiniSpark series={r.spark} up={up} />
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right text-ink-700">{r.market != null ? usd(r.market) : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-[12px] text-ink-500">{fmtDay(r.addedAt)}</td>
                          <td className="relative px-2 py-2.5">
                            <button type="button" onClick={() => setMenu(menu === key ? null : key)} className="text-ink-400 hover:text-ink-700" aria-label="More">
                              <Icons.More size={14} />
                            </button>
                            {menu === key ? (
                              <div className="absolute right-2 top-8 z-10 min-w-[120px] rounded-lg border border-ink-200 bg-white py-1 shadow-card">
                                <button
                                  type="button"
                                  onClick={() => drop(r.kind, r.id)}
                                  className="block w-full px-3 py-1.5 text-left text-[12px] text-rose-600 hover:bg-rose-50"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={8} className="px-3 py-10 text-center text-[13px] text-ink-400">
                        Nothing in this watchlist yet. Use Add to Watchlist.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between border-t border-ink-100 px-3 py-2 text-[12px] text-ink-500">
            <span>
              Showing {filtered.length ? (page - 1) * PAGE + 1 : 0} to {Math.min(page * PAGE, filtered.length)} of {filtered.length} items
            </span>
            <div className="flex items-center gap-1">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="grid h-7 w-7 place-items-center rounded-md border border-ink-200 disabled:opacity-40">
                ‹
              </button>
              {Array.from({ length: pages }, (_, i) => i + 1)
                .slice(0, 6)
                .map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`grid h-7 w-7 place-items-center rounded-md text-[12px] ${n === page ? "bg-arc-600 text-white" : "border border-ink-200 text-ink-600"}`}
                  >
                    {n}
                  </button>
                ))}
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} className="grid h-7 w-7 place-items-center rounded-md border border-ink-200 disabled:opacity-40">
                ›
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div id="watch-lists" className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink-900">My Lists</h2>
              <button
                type="button"
                onClick={() => {
                  setShowNew((v) => !v);
                  setNewList("");
                }}
                className="text-[12px] font-medium text-arc-600"
              >
                + New List
              </button>
            </div>
            {showNew ? (
              <form
                className="border-b border-ink-100 px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newList.trim();
                  if (name) {
                    void addList(name).then(() => {
                      setListNames(readLists());
                      setList(name);
                      setPage(1);
                    });
                  }
                  setNewList("");
                  setShowNew(false);
                }}
              >
                <input
                  autoFocus
                  value={newList}
                  onChange={(e) => setNewList(e.target.value)}
                  placeholder="List name"
                  className="w-full rounded-lg border border-ink-200 px-2 py-1 text-[12px] outline-none ring-arc-500 focus:ring-1"
                />
              </form>
            ) : null}
            {lists.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => {
                  setList(l.id);
                  setPage(1);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-[13px] hover:bg-ink-50 ${list === l.id ? "bg-ink-50" : ""}`}
              >
                <span className="inline-flex items-center gap-2 text-ink-800">
                  <span className={`h-2 w-2 rounded-full ${l.dot}`} />
                  {l.id}
                </span>
                <span className="text-ink-400">{l.count}</span>
              </button>
            ))}
            <button type="button" onClick={() => setList("all")} className="w-full border-t border-ink-100 px-3 py-2 text-left text-[12px] text-arc-600">
              View all lists →
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-ink-200 bg-white">
            <div className="border-b border-ink-100 px-3 py-2.5">
              <h2 className="text-[13px] font-semibold text-ink-900">Recently Added</h2>
            </div>
            {recent.length ? (
              recent.map((r) => (
                <Link key={`${r.kind}:${r.id}`} to={r.href} className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50">
                  <RowIcon r={r} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-ink-800">{r.name}</span>
                    <span className="block text-[11px] text-ink-400">{KIND_LABEL[r.kind]}</span>
                  </span>
                  <span className="text-[11px] text-ink-400">{fmtShort(r.addedAt)}</span>
                </Link>
              ))
            ) : (
              <p className="px-3 py-4 text-[12px] text-ink-400">No items yet.</p>
            )}
            <button type="button" onClick={() => setTab("all")} className="w-full border-t border-ink-100 px-3 py-2 text-left text-[12px] text-arc-600">
              View all activity →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Change({ n }: { n: number | null }) {
  if (n == null) return <span className="text-ink-300">—</span>;
  const up = n >= 0;
  return (
    <span className={`text-[12px] font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(n).toFixed(2)}%
    </span>
  );
}

function RowIcon({ r }: { r: Row }) {
  if (r.kind === "token" || r.kind === "contract") {
    return <TokenIcon address={r.id} src={r.icon} symbol={r.name} size={28} />;
  }
  if (r.kind === "protocol") {
    return <ProtocolIcon slug={r.id} name={r.name} size={28} />;
  }
  return (
    <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700">
      {r.name.slice(0, 1)}
    </span>
  );
}

function RowName({ r }: { r: Row }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <RowIcon r={r} />
      <span className="min-w-0 text-left">
        <span className="block truncate text-[13px] font-semibold text-ink-900">{r.name}</span>
        <span className="block truncate text-[11px] text-ink-400">{r.sub}</span>
      </span>
    </span>
  );
}
