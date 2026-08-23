import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DonutChart } from "@/components/charts/Charts";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import { Icons } from "@/components/shared/Icons";
import { Skel } from "@/components/shared/Skel";
import {
  ADDR_RE,
  TRACKED_KEY,
  WALLET_LABEL_PILL,
  type WalletLabel,
} from "@/config/wallets";
import { useAsyncData } from "@/hooks/useAsyncData";
import { isWatched, subscribeWatch, toggleWatch as toggleStar } from "@/libs/watchlist";
import {
  WALLET,
  clearWalletCaches,
  computeStats,
  loadWalletActivity,
  loadWalletList,
  loadWalletStats,
  loadWalletValued,
} from "@/libs/wallets";
import { explorerUrl } from "@/config/network";
import { paths } from "@/routes/paths";
import { ago, compact, pct, shortHash, usd } from "@/utils/format";

const DONUT_COLORS = ["#8b5cf6", "#3b82f6", "#f97316", "#10b981", "#94a3b8"];

function readList(key: string) {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function writeList(key: string, list: string[]) {
  localStorage.setItem(key, JSON.stringify(list));
}

function walletHue(addr: string) {
  const n = parseInt(addr.slice(2, 8), 16);
  return `hsl(${n % 360} 65% 45%)`;
}

function TrendSpark({ series, up }: { series: number[]; up: boolean }) {
  if (series.length < 2) return <span className="text-ink-300">—</span>;
  const max = Math.max(...series, 1);
  const line = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * 40;
      const y = 14 - (v / max) * 10;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="44" height="16" viewBox="0 0 44 16" className="inline-block">
      <polyline
        fill="none"
        stroke={up ? "#10b981" : "#f43f5e"}
        strokeWidth="1.5"
        points={line}
      />
    </svg>
  );
}

function WalletRowSkel() {
  return (
    <tr className="border-b border-ink-50">
      <td className="px-3 py-2"><Skel className="h-3 w-3" /></td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <Skel className="h-6 w-6 shrink-0 rounded-full" />
          <div className="space-y-1">
            <Skel className="h-3 w-20" />
            <Skel className="h-2.5 w-14" />
          </div>
        </div>
      </td>
      <td className="px-3 py-2"><Skel className="h-5 w-16 rounded-full" /></td>
      {Array.from({ length: 5 }, (_, i) => (
        <td key={i} className="px-3 py-2"><Skel className="ml-auto h-3 w-12" /></td>
      ))}
      <td className="px-3 py-2" />
    </tr>
  );
}

function ActivityRowSkel() {
  return (
    <tr className="border-b border-ink-50">
      {Array.from({ length: 6 }, (_, i) => (
        <td key={i} className="px-3 py-2">
          <Skel className={`h-3 ${i === 5 ? "ml-auto w-12" : "w-16"}`} />
        </td>
      ))}
    </tr>
  );
}

function DonutSkel({ title }: { title: string }) {
  return (
    <div className="card p-2.5">
      <div className="panel-title mb-2">{title}</div>
      <div className="flex items-center gap-3">
        <Skel className="h-24 w-24 shrink-0 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skel className="h-3 w-full" />
          <Skel className="h-3 w-4/5" />
          <Skel className="h-3 w-3/5" />
        </div>
      </div>
    </div>
  );
}

function SideListSkel({ title, rows = 5 }: { title: string; rows?: number }) {
  return (
    <div className="card p-3">
      <div className="panel-title mb-2">{title}</div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <Skel className="h-3 w-4" />
            <Skel className="h-3 flex-1" />
            <Skel className="h-3 w-10" />
            <Skel className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}

function InsightsSkel() {
  return (
    <div className="card p-3">
      <div className="panel-title mb-2">Tracked Wallet Insights</div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="space-y-1 text-center">
            <Skel className="mx-auto h-2.5 w-14" />
            <Skel className="mx-auto h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
export function WalletTrackerPage() {
  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [rev, setRev] = useState(0);
  const [tracked, setTracked] = useState<string[]>(() => readList(TRACKED_KEY));
  const [reload, setReload] = useState(0);

  useEffect(() => subscribeWatch(() => setRev((n) => n + 1)), []);

  const trackedKey = tracked.join(",");
  const deps = [reload, trackedKey];

  const listLoader = useCallback(
    () => loadWalletList(tracked),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  const statsLoader = useCallback(
    () => loadWalletStats(tracked),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );
  const activityLoader = useCallback(
    () => loadWalletActivity(tracked),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  const valuedLoader = useCallback(
    () => loadWalletValued(tracked),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  const listQ = useAsyncData(`${WALLET.list}:${trackedKey}`, listLoader, deps);
  const valuedQ = useAsyncData(`${WALLET.valued}:${trackedKey}`, valuedLoader, deps);
  const statsQ = useAsyncData(`${WALLET.stats}:${trackedKey}`, statsLoader, deps);
  const activityQ = useAsyncData(`${WALLET.activity}:${trackedKey}`, activityLoader, deps);

  // API rows first; live token prices + last tx fill in when valued pass completes.
  const wallets = valuedQ.data ?? listQ.data ?? [];
  const activity = activityQ.data ?? [];
  const stats = useMemo(() => {
    if (valuedQ.data?.length) return computeStats(valuedQ.data, statsQ.data);
    return statsQ.data ?? undefined;
  }, [valuedQ.data, statsQ.data]);
  const listBoot = listQ.loading && !listQ.data && !valuedQ.data;
  const statsBoot = statsQ.loading && !statsQ.data && !valuedQ.data;
  const activityBoot = activityQ.loading && !activityQ.data;
  const error = listQ.error ?? statsQ.error ?? activityQ.error ?? valuedQ.error;

  const toggleWatch = (addr: string) => {
    void toggleStar("wallet", addr);
  };

  const addWallet = () => {
    const addr = search.trim().toLowerCase();
    if (!ADDR_RE.test(addr) || tracked.includes(addr)) return;
    const next = [...tracked, addr];
    setTracked(next);
    writeList(TRACKED_KEY, next);
    clearWalletCaches(tracked);
    clearWalletCaches(next);
    setReload((r) => r + 1);
    setSearch("");
  };

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return wallets;
    return wallets.filter(
      (w) =>
        w.address.includes(query) ||
        (w.name?.toLowerCase().includes(query) ?? false) ||
        w.label.toLowerCase().includes(query),
    );
  }, [wallets, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const valueChange =
    stats && stats.valueSpark.length > 1
      ? ((stats.valueSpark.at(-1)! - stats.valueSpark[0]) / Math.max(stats.valueSpark[0], 1)) * 100
      : undefined;

  return (
    <div className="min-w-0 space-y-2.5">
      {error && !wallets.length && !stats ? (
        <div className="text-sm text-ink-400">{error}</div>
      ) : null}
      <div className="flex gap-2">
        <input
          type="search"
          id="wallet-track-input"
          placeholder="Paste 0x address to track"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addWallet()}
          className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] outline-none focus:border-arc-400"
        />
        <button
          type="button"
          onClick={addWallet}
          className="rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-4 py-2 text-[12px] font-medium text-white"
        >
          Track
        </button>
      </div>

      <div className="metric-grid xl:grid-cols-5">
        <MetricCard
          label="Wallets Tracked"
          value={compact(stats?.tracked ?? 0)}
          icon={<Icons.Wallet size={11} />}
          color="#8b5cf6"
          series={stats?.txSpark}
          loading={statsBoot}
          hasSpark
        />
        <MetricCard
          label="Total Value Tracked"
          value={usd(stats?.totalValue ?? 0)}
          change={valueChange}
          icon={<Icons.Activity size={11} />}
          color="#3b82f6"
          series={stats?.valueSpark}
          loading={statsBoot}
          hasSpark
        />
        <MetricCard
          label="Top 10 Wallets Value"
          value={usd(stats?.top10Value ?? 0)}
          icon={<Icons.Rankings size={11} />}
          color="#06b6d4"
          loading={statsBoot}
        />
        <MetricCard
          label="Active Wallets (24h)"
          value={compact(stats?.active24h ?? 0)}
          icon={<Icons.Users size={11} />}
          color="#10b981"
          loading={statsBoot}
        />
        <MetricCard
          label="Transactions (24h)"
          value={compact(stats?.txs24h ?? 0)}
          icon={<Icons.Tx size={11} />}
          color="#6366f1"
          series={stats?.txSpark}
          loading={statsBoot}
          hasSpark
        />
      </div>

      <div className="grid min-w-0 gap-2 lg:grid-cols-3">
        <div className="min-w-0 space-y-2 lg:col-span-2">
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-3 py-2">
              <input
                type="search"
                placeholder="Filter wallets…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                className="min-w-[140px] flex-1 rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-arc-400"
              />
            </div>

            <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] text-ink-400">
                    <th className="w-8 px-3 py-2.5 font-medium">#</th>
                    <th className="px-3 py-2.5 font-medium">Wallet</th>
                    <th className="px-3 py-2.5 font-medium">Label</th>
                    <th className="px-3 py-2.5 text-right font-medium">Net Worth</th>
                    <th className="px-3 py-2.5 text-right font-medium">24h</th>
                    <th className="px-3 py-2.5 text-right font-medium">7D</th>
                    <th className="px-3 py-2.5 text-right font-medium">Txns (24h)</th>
                    <th className="px-3 py-2.5 text-right font-medium">Last Active</th>
                    <th className="w-8 px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {listBoot
                    ? Array.from({ length: pageSize }, (_, i) => <WalletRowSkel key={i} />)
                    : pageRows.map((w, i) => {
                    const rank = (page - 1) * pageSize + i + 1;
                    const starred = rev >= 0 && isWatched("wallet", w.address);
                    const up24 = (w.change24h ?? 0) >= 0;
                    const up7 = (w.change7d ?? 0) >= 0;
                    return (
                      <tr key={w.address} className="border-b border-ink-50 hover:bg-ink-50/60">
                        <td className="px-3 py-2 text-ink-400">{rank}</td>
                        <td className="px-3 py-2">
                          <Link
                            to={paths.address(w.address)}
                            className="inline-flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                          >
                            <span
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold text-white"
                              style={{ background: walletHue(w.address) }}
                            >
                              {w.address.slice(2, 4).toUpperCase()}
                            </span>
                            <span>
                              <span className="block">{w.name ?? shortHash(w.address)}</span>
                              <span className="font-mono text-[10px] text-ink-400">
                                {shortHash(w.address, 6, 4)}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${WALLET_LABEL_PILL[w.label as WalletLabel] ?? WALLET_LABEL_PILL["DeFi User"]}`}
                          >
                            {w.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-medium text-ink-800">
                          {usd(w.netWorth)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className={`font-medium ${up24 ? "text-emerald-600" : "text-rose-600"}`}>
                            {pct(w.change24h ?? undefined) ?? "—"}
                          </div>
                          <TrendSpark series={w.spark24h} up={up24} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className={`font-medium ${up7 ? "text-emerald-600" : "text-rose-600"}`}>
                            {pct(w.change7d ?? undefined) ?? "—"}
                          </div>
                          <TrendSpark series={w.spark7d} up={up7} />
                        </td>
                        <td className="px-3 py-2 text-right text-ink-700">{compact(w.txs24h)}</td>
                        <td className="px-3 py-2 text-right text-ink-500">
                          {w.lastActive ? ago(w.lastActive) : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => toggleWatch(w.address)}
                            className={starred ? "text-amber-500" : "text-ink-300 hover:text-amber-400"}
                            aria-label="Watchlist"
                          >
                            {starred ? <Icons.StarFilled size={12} /> : <Icons.Star size={12} />}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!listBoot && !pageRows.length && (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-ink-400">
                        No wallets match this filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-3 py-2 text-[11px] text-ink-500">
              <span>
                Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
                {filtered.length}
              </span>
              <div className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-ink-200 px-2 py-0.5 disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-ink-200 px-2 py-0.5 disabled:opacity-40"
                >
                  Next
                </button>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="ml-2 rounded border border-ink-200 bg-white px-2 py-0.5"
                >
                  {[10, 20, 50].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-3 py-2">
              <div className="min-w-0 truncate panel-title">Recent Wallet Activity</div>
              <a href="/explorer/transactions" className="shrink-0 text-[11px] text-arc-600 hover:underline">
                View all
              </a>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[12px]">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] text-ink-400">
                    <th className="px-3 py-2 font-medium">Time</th>
                    <th className="px-3 py-2 font-medium">Wallet</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Protocol / Token</th>
                    <th className="px-3 py-2 text-right font-medium">Value</th>
                    <th className="px-3 py-2 text-right font-medium">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {activityBoot
                    ? Array.from({ length: 6 }, (_, i) => <ActivityRowSkel key={i} />)
                    : activity.map((a) => (
                    <tr key={a.hash} className="border-b border-ink-50">
                      <td className="px-3 py-2 text-ink-500">{a.time ? ago(a.time) : "—"}</td>
                      <td className="px-3 py-2 font-mono text-[11px]">{shortHash(a.address)}</td>
                      <td className="px-3 py-2 text-ink-700">{a.action}</td>
                      <td className="px-3 py-2 text-ink-600">{a.target}</td>
                      <td className="px-3 py-2 text-right font-medium">{usd(a.valueUsd)}</td>
                      <td className="px-3 py-2 text-right">
                        <a
                          href={explorerUrl(`/tx/${a.hash}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="text-arc-600 hover:underline"
                        >
                          View tx
                        </a>
                      </td>
                    </tr>
                  ))}
                  {!activityBoot && !activity.length && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-ink-400">
                        No recent activity from tracked wallets.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-2">
          {statsBoot ? (
            <DonutSkel title="Portfolio Distribution" />
          ) : (
            <DonutChart
              title="Portfolio Distribution"
              slices={stats?.portfolio ?? []}
              colors={DONUT_COLORS}
            />
          )}

          {statsBoot ? (
            <SideListSkel title="Top Gainers (24h)" />
          ) : (
          <div className="card p-3">
            <div className="panel-title mb-2">Top Gainers (24h)</div>
            <div className="space-y-2">
              {(stats?.gainers ?? []).map((g, i) => (
                <div key={g.address} className="flex min-w-0 items-center justify-between gap-1.5 text-[12px]">
                  <span className="shrink-0 text-ink-500">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-700">
                    {shortHash(g.address)}
                  </span>
                  <span className="shrink-0 font-medium text-emerald-600">{pct(g.change)}</span>
                  <span className="shrink-0 text-ink-500">{usd(g.delta)}</span>
                </div>
              ))}
              {!stats?.gainers?.length && (
                <div className="text-[11px] text-ink-400">No balance history yet.</div>
              )}
            </div>
          </div>
          )}

          {statsBoot ? (
            <SideListSkel title="Top Losers (24h)" />
          ) : (
          <div className="card p-3">
            <div className="panel-title mb-2">Top Losers (24h)</div>
            <div className="space-y-2">
              {(stats?.losers ?? []).map((g, i) => (
                <div key={g.address} className="flex min-w-0 items-center justify-between gap-1.5 text-[12px]">
                  <span className="shrink-0 text-ink-500">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ink-700">
                    {shortHash(g.address)}
                  </span>
                  <span className="shrink-0 font-medium text-rose-600">{pct(g.change)}</span>
                  <span className="shrink-0 text-ink-500">{usd(g.delta)}</span>
                </div>
              ))}
              {!stats?.losers?.length && (
                <div className="text-[11px] text-ink-400">No balance history yet.</div>
              )}
            </div>
          </div>
          )}

          {statsBoot ? (
            <InsightsSkel />
          ) : (
          <div className="card p-3">
            <div className="panel-title mb-2">Tracked Wallet Insights</div>
            <div className="grid min-w-0 grid-cols-3 gap-2 text-center">
              <div className="min-w-0">
                <div className="text-[10px] text-ink-400">24h Net Flow</div>
                <div
                  className={`truncate text-[13px] font-semibold ${(stats?.netFlow24h ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {(stats?.netFlow24h ?? 0) >= 0 ? "+" : ""}
                  {usd(stats?.netFlow24h ?? 0)}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-ink-400">Avg. Wallet Age</div>
                <div className="truncate text-[13px] font-semibold text-ink-800">
                  {(stats?.avgAgeDays ?? 0) > 0 ? `${stats!.avgAgeDays}d` : "—"}
                </div>
              </div>
              <div className="min-w-0">
                <div className="text-[10px] text-ink-400">Active Rate</div>
                <div className="truncate text-[13px] font-semibold text-ink-800">
                  {(stats?.activeRate ?? 0).toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
          )}

          <button
            type="button"
            onClick={() => document.getElementById("wallet-track-input")?.focus()}
            className="w-full rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 py-2.5 text-[12px] font-medium text-white"
          >
            + Add Wallet to Track
          </button>
        </div>
      </div>
    </div>
  );
}
