import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChartCard, DonutChart } from "@/components/charts/Charts";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import { Icons } from "@/components/shared/Icons";
import { TokenIcon } from "@/components/shared/TokenIcon";
import {
  NFT_CATEGORY_PILL,
  NFT_FILTERS,
  type NftCategory,
} from "@/config/nfts";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadNftDashboard, type NftCollection } from "@/libs/nfts";
import { isWatched, subscribeWatch, toggleWatch as toggleStar } from "@/libs/watchlist";
import { paths } from "@/routes/paths";
import { compact, shortHash } from "@/utils/format";

const CACHE_KEY = "nfts-dashboard-v1";
const DONUT_COLORS = ["#8b5cf6", "#3b82f6", "#f97316", "#10b981", "#06b6d4", "#94a3b8"];

function exportCsv(rows: NftCollection[]) {
  const header = "address,name,symbol,category,holders,transfers\n";
  const body = rows
    .map((r) =>
      [r.address, r.name, r.symbol, r.category, r.holders, r.transfers ?? ""]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arc-nft-collections.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function NftsPage() {
  const [filter, setFilter] = useState<NftCategory>("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"holders" | "transfers" | "name">("holders");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [rev, setRev] = useState(0);

  useEffect(() => subscribeWatch(() => setRev((n) => n + 1)), []);

  const { data, loading, error } = useAsyncData(CACHE_KEY, loadNftDashboard);
  const collections = data?.collections ?? [];
  const stats = data?.stats;
  const activity = data?.activity ?? [];

  const toggleWatch = (addr: string) => {
    void toggleStar("contract", addr);
  };

  const filtered = useMemo(() => {
    let list = collections;
    if (filter !== "all") list = list.filter((c) => c.category === filter);
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.symbol.toLowerCase().includes(query) ||
          c.address.includes(query),
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "transfers") return (b.transfers ?? 0) - (a.transfers ?? 0);
      return b.holders - a.holders;
    });
  }, [collections, filter, q, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const donut = useMemo(() => {
    const top = [...collections].sort((a, b) => b.holders - a.holders).slice(0, 5);
    const rest = collections.reduce((s, c) => s + c.holders, 0) - top.reduce((s, c) => s + c.holders, 0);
    const slices = top.map((c) => ({
      label: c.name || c.symbol || shortHash(c.address),
      value: c.holders,
    }));
    if (rest > 0) slices.push({ label: "Other", value: rest });
    return slices.filter((s) => s.value > 0);
  }, [collections]);

  if (loading && !collections.length) {
    return <div className="text-sm text-ink-400">Loading NFT collections…</div>;
  }
  if (error && !collections.length) {
    return <div className="text-sm text-ink-400">{error}</div>;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-ink-400">
          ERC-721 collections on Arc testnet — holders &amp; transfer counts from ArcScan
        </p>
        <button
          type="button"
          onClick={() => exportCsv(filtered)}
          className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-ink-600 hover:border-arc-400"
        >
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Collections"
          value={compact(stats?.collections ?? 0)}
          icon={<Icons.Nfts size={13} />}
          color="#8b5cf6"
          series={stats?.activitySpark}
        />
        <MetricCard
          label="Holder Accounts"
          value={compact(stats?.holderAccounts ?? 0)}
          icon={<Icons.Users size={13} />}
          color="#3b82f6"
        />
        <MetricCard
          label="Collection Transfers"
          value={compact(stats?.transfers ?? 0)}
          icon={<Icons.Activity size={13} />}
          color="#06b6d4"
        />
        <MetricCard
          label="Avg Holders"
          value={compact(stats?.avgHolders ?? 0)}
          icon={<Icons.Wallet size={13} />}
          color="#10b981"
        />
        <MetricCard
          label="Network Txns (24h)"
          value={compact(stats?.txns24h ?? 0)}
          icon={<Icons.Tx size={13} />}
          color="#6366f1"
          series={stats?.activitySpark}
        />
        <MetricCard
          label="Top Collection"
          value={stats?.topName ? stats.topName.slice(0, 12) : "—"}
          icon={<Icons.Rankings size={13} />}
          color="#f97316"
        />
      </div>

      <div className="grid gap-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AreaChartCard title="Network Activity" data={activity} color="#8b5cf6" />
        </div>
        <div className="space-y-2">
          <DonutChart title="Top by Holders" slices={donut} colors={DONUT_COLORS} />
          <div className="card p-2.5 text-[11px]">
            <div className="panel-title mb-1.5">Overview</div>
            <dl className="space-y-1 text-ink-600">
              <div className="flex justify-between gap-2">
                <dt>Collections loaded</dt>
                <dd className="font-medium text-ink-800">{compact(stats?.collections ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Holder accounts</dt>
                <dd className="font-medium text-ink-800">{compact(stats?.holderAccounts ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Tracked transfers</dt>
                <dd className="font-medium text-ink-800">{compact(stats?.transfers ?? 0)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Txns (24h)</dt>
                <dd className="font-medium text-ink-800">{compact(stats?.txns24h ?? 0)}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[10px] leading-snug text-ink-400">
              Floor price, sales, and 7D volume are not exposed by ArcScan testnet yet.
            </p>
          </div>
        </div>
      </div>

      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        {NFT_FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                active
                  ? "border-transparent bg-gradient-to-r from-violet-500 to-blue-500 text-white"
                  : "border-ink-200 bg-white text-ink-500 hover:border-arc-400 hover:text-arc-700"
              }`}
            >
              <Icon size={13} />
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-3 py-2">
          <input
            type="search"
            placeholder="Search collections…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            className="min-w-[140px] flex-1 rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-arc-400"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="rounded-md border border-ink-200 bg-white px-2 py-1.5 text-[12px] text-ink-600"
          >
            <option value="holders">Sort: Holders</option>
            <option value="transfers">Sort: Transfers</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-ink-100 text-[11px] text-ink-400">
                <th className="w-8 px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Collection</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">Holders</th>
                <th className="px-3 py-2 text-right font-medium">Transfers</th>
                <th className="px-3 py-2 text-right font-medium">Supply</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c, i) => {
                const rank = (page - 1) * pageSize + i + 1;
                const starred = rev >= 0 && isWatched("contract", c.address);
                return (
                  <tr key={c.address} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="w-4 text-[10px] text-ink-400">{rank}</span>
                        <button
                          type="button"
                          onClick={() => toggleWatch(c.address)}
                          className={starred ? "text-amber-500" : "text-ink-300 hover:text-amber-400"}
                          aria-label="Watchlist"
                        >
                          {starred ? <Icons.StarFilled size={12} /> : <Icons.Star size={12} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        to={paths.token(c.address)}
                        className="inline-flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                      >
                        <TokenIcon address={c.address} src={c.iconUrl} symbol={c.symbol} size={22} />
                        <span>
                          <span className="block">{c.name || shortHash(c.address)}</span>
                          {c.symbol && (
                            <span className="text-[10px] font-normal text-ink-400">{c.symbol}</span>
                          )}
                        </span>
                        {c.reputation === "ok" && (
                          <span className="text-[10px] text-sky-500" title="Verified on ArcScan">
                            ✓
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${NFT_CATEGORY_PILL[c.category]}`}
                      >
                        {c.category === "pfp" ? "PFPs" : c.category}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-ink-800">
                      {compact(c.holders)}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-700">
                      {c.transfers != null ? compact(c.transfers) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-ink-500">
                      {c.supply != null ? compact(c.supply) : "—"}
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-ink-400">
                    No collections match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-3 py-2 text-[11px] text-ink-500">
          <span>
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} of{" "}
            {compact(filtered.length)}
          </span>
          <div className="flex items-center gap-2">
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[11px]"
            >
              {[10, 15, 25, 50].map((n) => (
                <option key={n} value={n}>
                  {n} rows
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded border border-ink-200 px-2 py-0.5 disabled:opacity-40"
            >
              Prev
            </button>
            <span>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded border border-ink-200 px-2 py-0.5 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
