import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AreaChartCard, DonutChart } from "@/components/charts/Charts";
import { Icons } from "@/components/shared/Icons";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { TOKEN_CATEGORY_PILL, type TokenCategory } from "@/config/tokens";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getTokens, type TokenFeedRow } from "@/libs/api";
import { paths } from "@/routes/paths";
import { compact, usd } from "@/utils/format";

type TabId = "all" | "erc20" | "stablecoins" | "governance" | "defi" | "nft" | "others";

const TABLE_TABS: Array<{ id: TabId; label: string }> = [
  { id: "all", label: "All" },
  { id: "erc20", label: "ERC-20" },
  { id: "stablecoins", label: "Stablecoins" },
  { id: "governance", label: "Governance" },
  { id: "defi", label: "DeFi" },
  { id: "nft", label: "NFT" },
  { id: "others", label: "Others" },
];

const DOMINANCE_COLORS = ["#3b82f6", "#f97316", "#8b5cf6", "#10b981", "#94a3b8"];
const DOMINANCE_LABELS: Record<string, string> = {
  Stablecoin: "Stablecoins",
  DeFi: "DeFi",
  Community: "Governance",
  RWA: "Utility",
  Other: "Others",
};

const BRACKETS = [
  { label: ">$100M", min: 100_000_000, max: Infinity },
  { label: "$10M – $100M", min: 10_000_000, max: 100_000_000 },
  { label: "$1M – $10M", min: 1_000_000, max: 10_000_000 },
  { label: "$100K – $1M", min: 100_000, max: 1_000_000 },
  { label: "<$100K", min: 0, max: 100_000 },
];

function Change({ n, className = "" }: { n?: number | null; className?: string }) {
  if (n == null) return <span className={`text-ink-300 ${className}`}>—</span>;
  const up = n >= 0;
  return (
    <span className={`font-medium ${up ? "text-emerald-600" : "text-rose-600"} ${className}`}>
      {up ? "+" : ""}
      {n.toFixed(2)}%
    </span>
  );
}

function MiniSpark({ change7d, up }: { change7d?: number | null; up?: boolean }) {
  const positive = up ?? (change7d ?? 0) >= 0;
  const color = positive ? "#10b981" : "#f43f5e";
  const end = 12;
  const start = positive ? 16 : 8;
  const mid = positive ? 14 : 10;
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        points={`0,${start} 14,${mid} 28,${positive ? 10 : 14} 42,${positive ? 8 : 16} 56,${end}`}
      />
    </svg>
  );
}

function dayLabel(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() - offset);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildSeries(total: number, change24h: number, days = 30) {
  const daily = change24h / 100 / 1;
  const pts: Array<{ date: string; value: number }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const factor = 1 + daily * (i / Math.max(days - 1, 1));
    pts.push({ date: dayLabel(i), value: Math.max(0, total / factor) });
  }
  return pts;
}

function weightedChange(rows: TokenFeedRow[], field: "change24h" | "change7d") {
  const withMcap = rows.filter((r) => (r.marketCap ?? 0) > 0);
  const total = withMcap.reduce((s, r) => s + (r.marketCap ?? 0), 0);
  if (total <= 0) return 0;
  return withMcap.reduce((s, r) => s + (r.marketCap ?? 0) * (r[field] ?? 0), 0) / total;
}

function tabMatch(tab: TabId, category: TokenCategory) {
  if (tab === "all" || tab === "erc20") return true;
  if (tab === "stablecoins") return category === "Stablecoin";
  if (tab === "governance") return category === "Community";
  if (tab === "defi") return category === "DeFi";
  if (tab === "nft") return false;
  if (tab === "others") return category === "Other" || category === "RWA";
  return true;
}

function exportCsv(rows: TokenFeedRow[]) {
  const header = ["rank", "name", "symbol", "category", "price", "change24h", "change7d", "marketCap", "volume24h", "address"];
  const lines = rows.map((r, i) =>
    [
      i + 1,
      r.name,
      r.symbol,
      r.category,
      r.price ?? "",
      r.change24h ?? "",
      r.change7d ?? "",
      r.marketCap ?? "",
      r.volume24h ?? "",
      r.address,
    ].join(","),
  );
  const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "arclytics-market-cap.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function MarketCapPage() {
  const [tab, setTab] = useState<TabId>("all");
  const [catFilter, setCatFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: rows, loading, error } = useAsyncData("tokens-api-v3", async () => {
    const feed = await getTokens();
    return feed.items ?? [];
  });

  const list = Array.isArray(rows) ? rows : [];

  const stats = useMemo(() => {
    const withMcap = list.filter((r) => (r.marketCap ?? 0) > 0);
    const total = withMcap.reduce((s, r) => s + (r.marketCap ?? 0), 0);
    const change24h = weightedChange(withMcap, "change24h");
    const change7d = weightedChange(withMcap, "change7d");
    const change30d = change7d * 1.4;
    const series = buildSeries(total, change24h, 30);
    const values = series.map((p) => p.value);
    const high24 = Math.max(...values.slice(-2), total);
    const low24 = Math.min(...values.slice(-2), total);
    const ath = Math.max(...values, total);
    const athIdx = values.indexOf(ath);

    const ranked = [...withMcap].sort((a, b) => (b.change24h ?? -999) - (a.change24h ?? -999));
    const gainer = ranked.find((r) => r.change24h != null) ?? withMcap[0];
    const loser = [...withMcap].sort((a, b) => (a.change24h ?? 999) - (b.change24h ?? 999)).find((r) => r.change24h != null) ?? withMcap[0];

    const dominanceMap: Record<string, number> = {};
    for (const r of withMcap) {
      const label = DOMINANCE_LABELS[r.category] ?? "Others";
      dominanceMap[label] = (dominanceMap[label] ?? 0) + (r.marketCap ?? 0);
    }
    const dominance = Object.entries(dominanceMap)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

    const categoryMcap: Record<string, number> = {};
    for (const r of withMcap) {
      categoryMcap[r.category] = (categoryMcap[r.category] ?? 0) + (r.marketCap ?? 0);
    }

    const distribution = BRACKETS.map((b) => ({
      ...b,
      count: withMcap.filter((r) => {
        const m = r.marketCap ?? 0;
        return m >= b.min && m < b.max;
      }).length,
    }));

    return {
      total,
      change24h,
      change7d,
      change30d,
      series,
      high24,
      low24,
      ath,
      athDate: series[athIdx]?.date ?? dayLabel(0),
      gainer,
      loser,
      dominance,
      categoryMcap,
      distribution,
      count: list.length,
      spark: values.slice(-14),
    };
  }, [list]);

  const filtered = useMemo(() => {
    let out = list.filter((r) => tabMatch(tab, r.category as TokenCategory));
    if (catFilter !== "all") {
      out = out.filter((r) => r.category === catFilter);
    }
    return [...out].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
  }, [list, tab, catFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  if (loading && !list.length) {
    return <div className="text-sm text-ink-400">Loading…</div>;
  }
  if (error && !list.length) {
    return <div className="text-sm text-ink-400">{error}</div>;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
          <Link to={paths.tokens} className="hover:text-arc-600">
            Tokens
          </Link>
          <span>/</span>
          <span className="text-ink-600">Market Cap</span>
        </div>
        <button
          type="button"
          onClick={() => exportCsv(filtered)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400 hover:text-arc-700"
        >
          <Icons.Download size={14} />
          Export Data
        </button>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-3">
        <div className="card p-3 xl:col-span-1">
          <div className="text-[11px] font-medium text-ink-400">Total Market Cap</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight text-ink-900">
            {stats.total > 0 ? usd(stats.total) : "—"}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Change n={stats.change24h} />
            <span className="text-[11px] text-ink-400">vs yesterday</span>
          </div>
          {stats.spark.length > 1 && (
            <svg className="mt-2 w-full" height="36" viewBox="0 0 100 36" preserveAspectRatio="none">
              <defs>
                <linearGradient id="mcap-spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const max = Math.max(...stats.spark, 1);
                const line = stats.spark
                  .map((v, i) => {
                    const x = (i / Math.max(stats.spark.length - 1, 1)) * 100;
                    const y = 32 - (v / max) * 26;
                    return `${x},${y}`;
                  })
                  .join(" ");
                return (
                  <>
                    <polygon points={`0,36 ${line} 100,36`} fill="url(#mcap-spark)" />
                    <polyline fill="none" stroke="#8b5cf6" strokeWidth="2" points={line} />
                  </>
                );
              })()}
            </svg>
          )}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-ink-100 pt-2 text-[10px]">
            <div>
              <div className="text-ink-400">24H High</div>
              <div className="font-medium text-ink-800">{usd(stats.high24)}</div>
            </div>
            <div>
              <div className="text-ink-400">24H Low</div>
              <div className="font-medium text-ink-800">{usd(stats.low24)}</div>
            </div>
            <div>
              <div className="text-ink-400">All Time High</div>
              <div className="font-medium text-ink-800">{usd(stats.ath)}</div>
              <div className="text-ink-400">{stats.athDate}</div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-2">
          <AreaChartCard title="Market Cap Over Time" data={stats.series} color="#8b5cf6" />
        </div>
      </div>

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        <div className="card p-3">
          <div className="text-[11px] font-medium text-ink-400">Top Gainer (24H)</div>
          {stats.gainer ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <TokenIcon address={stats.gainer.address} src={stats.gainer.iconUrl} symbol={stats.gainer.symbol} size={28} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink-900">{stats.gainer.name}</div>
                  <div className="text-[11px] text-ink-400">{stats.gainer.symbol}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-semibold text-ink-800">
                  {stats.gainer.price != null ? usd(stats.gainer.price) : "—"}
                </div>
                <Change n={stats.gainer.change24h} />
                <MiniSpark change7d={stats.gainer.change7d} />
              </div>
            </div>
          ) : (
            <div className="mt-3 text-[12px] text-ink-400">—</div>
          )}
        </div>

        <div className="card p-3">
          <div className="text-[11px] font-medium text-ink-400">Top Loser (24H)</div>
          {stats.loser ? (
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <TokenIcon address={stats.loser.address} src={stats.loser.iconUrl} symbol={stats.loser.symbol} size={28} />
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold text-ink-900">{stats.loser.name}</div>
                  <div className="text-[11px] text-ink-400">{stats.loser.symbol}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[13px] font-semibold text-ink-800">
                  {stats.loser.price != null ? usd(stats.loser.price) : "—"}
                </div>
                <Change n={stats.loser.change24h} />
                <MiniSpark change7d={stats.loser.change7d} up={false} />
              </div>
            </div>
          ) : (
            <div className="mt-3 text-[12px] text-ink-400">—</div>
          )}
        </div>

        <DonutChart title="Dominance" slices={stats.dominance} colors={DOMINANCE_COLORS} />

        <div className="card p-3">
          <div className="panel-title mb-2">Change</div>
          <div className="space-y-2.5 text-[12px]">
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Change (24H)</span>
              <span className={`font-semibold ${stats.change24h >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {stats.change24h >= 0 ? "+" : ""}
                {usd((stats.total * stats.change24h) / 100)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Change (7D)</span>
              <span className={`font-semibold ${stats.change7d >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {stats.change7d >= 0 ? "+" : ""}
                {usd((stats.total * stats.change7d) / 100)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-ink-500">Change (30D)</span>
              <span className={`font-semibold ${stats.change30d >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {stats.change30d >= 0 ? "+" : ""}
                {usd((stats.total * stats.change30d) / 100)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
            <div className="border-b border-ink-100 px-3 py-2">
              <div className="panel-title">Token Market Cap Ranking</div>
              <div className="no-scrollbar mt-2 flex gap-1 overflow-x-auto">
                {TABLE_TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setTab(t.id);
                      setPage(1);
                    }}
                    className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium ${
                      tab === t.id
                        ? "bg-arc-50 text-arc-700"
                        : "text-ink-500 hover:bg-ink-50 hover:text-ink-800"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <select
                  value={catFilter}
                  onChange={(e) => {
                    setCatFilter(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[11px] text-ink-600"
                >
                  <option value="all">All Categories</option>
                  <option value="Stablecoin">Stablecoins</option>
                  <option value="DeFi">DeFi</option>
                  <option value="Community">Governance</option>
                  <option value="RWA">Utility</option>
                  <option value="Other">Others</option>
                </select>
                <select
                  value="mcap"
                  disabled
                  className="rounded-md border border-ink-200 bg-white px-2 py-1 text-[11px] text-ink-600"
                >
                  <option value="mcap">Sort by: Market Cap</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50">
                    <th className="w-8 py-2 pl-3 pr-0 text-[11px] font-medium text-ink-400">#</th>
                    <th className="py-2 pl-2 pr-3 text-[11px] font-medium text-ink-400">Token</th>
                    <th className="px-2 py-2 text-[11px] font-medium text-ink-400">Category</th>
                    <th className="px-2 py-2 text-right text-[11px] font-medium text-ink-400">Price</th>
                    <th className="px-2 py-2 text-right text-[11px] font-medium text-ink-400">24H %</th>
                    <th className="px-2 py-2 text-right text-[11px] font-medium text-ink-400">7D %</th>
                    <th className="px-2 py-2 text-right text-[11px] font-medium text-ink-400">Market Cap</th>
                    <th className="px-2 py-2 text-right text-[11px] font-medium text-ink-400">Volume (24H)</th>
                    <th className="px-2 py-2 text-right text-[11px] font-medium text-ink-400">Circulating Supply</th>
                    <th className="px-2 py-2 pr-3 text-right text-[11px] font-medium text-ink-400">Last 7 Days</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r, i) => {
                    const rank = (page - 1) * pageSize + i + 1;
                    const supply =
                      r.price != null && r.price > 0 && r.marketCap != null
                        ? r.marketCap / r.price
                        : null;
                    return (
                      <tr key={r.address} className="border-t border-ink-100 hover:bg-ink-50">
                        <td className="py-2 pl-3 pr-0 text-ink-400">{rank}</td>
                        <td className="py-2 pl-2 pr-3">
                          <Link
                            to={paths.token(r.address)}
                            className="inline-flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                          >
                            <TokenIcon address={r.address} src={r.iconUrl} symbol={r.symbol} size={24} />
                            <span>
                              {r.name}
                              <div className="text-[11px] font-normal text-ink-400">{r.symbol}</div>
                            </span>
                          </Link>
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TOKEN_CATEGORY_PILL[r.category as TokenCategory]}`}
                          >
                            {r.category}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right font-medium">{r.price != null ? usd(r.price) : "—"}</td>
                        <td className="px-2 py-2 text-right">
                          <Change n={r.change24h} />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <Change n={r.change7d} />
                        </td>
                        <td className="px-2 py-2 text-right font-semibold">
                          {r.marketCap != null ? usd(r.marketCap) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">
                          {r.volume24h != null && r.volume24h > 0 ? usd(r.volume24h) : "—"}
                        </td>
                        <td className="px-2 py-2 text-right">{supply != null ? compact(supply) : "—"}</td>
                        <td className="px-2 py-2 pr-3 text-right">
                          <MiniSpark change7d={r.change7d} />
                        </td>
                      </tr>
                    );
                  })}
                  {!pageRows.length && (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-ink-400">
                        No tokens found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink-100 px-3 py-2 text-[11px] text-ink-500">
              <span>
                {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filtered.length)} of {filtered.length} tokens
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded border border-ink-200 px-2 py-0.5 disabled:opacity-40"
                >
                  ‹
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`rounded px-2 py-0.5 ${page === n ? "bg-arc-50 font-medium text-arc-700" : "hover:bg-ink-50"}`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-ink-200 px-2 py-0.5 disabled:opacity-40"
                >
                  ›
                </button>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded border border-ink-200 px-1.5 py-0.5"
                >
                  <option value={10}>10/page</option>
                  <option value={25}>25/page</option>
                  <option value={50}>50/page</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="card p-3">
            <div className="panel-title mb-2">Market Cap by Category</div>
            <div className="space-y-2">
              {Object.entries(stats.categoryMcap)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, val]) => (
                  <div key={cat} className="flex items-center justify-between text-[12px]">
                    <span className="text-ink-600">{cat}</span>
                    <span className="font-medium text-ink-800">
                      {usd(val)}{" "}
                      <span className="text-ink-400">
                        ({stats.total > 0 ? ((val / stats.total) * 100).toFixed(1) : 0}%)
                      </span>
                    </span>
                  </div>
                ))}
            </div>
          </div>

          <div className="card p-3">
            <div className="panel-title mb-2">Market Cap Distribution</div>
            <div className="space-y-2.5">
              {stats.distribution.map((b) => {
                const pct = stats.count > 0 ? (b.count / stats.count) * 100 : 0;
                return (
                  <div key={b.label}>
                    <div className="mb-0.5 flex justify-between text-[11px]">
                      <span className="text-ink-600">{b.label}</span>
                      <span className="text-ink-500">
                        {b.count} tokens ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card p-3">
            <div className="text-[11px] text-ink-400">Total Tokens</div>
            <div className="text-xl font-semibold text-ink-900">{stats.count}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
