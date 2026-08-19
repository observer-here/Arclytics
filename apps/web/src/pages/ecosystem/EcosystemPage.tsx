import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Icons } from "@/components/shared/Icons";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import { PageNav } from "@/components/shared/PageNav";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import {
  CATEGORY_PILL,
  ECOSYSTEM_FILTERS,
  type EcosystemFilterId,
} from "@/config/ecosystem";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadEcosystemFeed } from "@/libs/api";
import { compact, usd } from "@/utils/format";

type Row = {
  slug: string;
  name: string;
  category: string;
  tvlUsd: number;
  change24h?: number;
  change7d?: number;
  change1m?: number;
  volume24h?: number;
  fees24h?: number;
  mcapTvl?: number;
  age?: string;
  spark7d?: number[];
};

const PAGE_SIZE = 20;

function MiniSpark({ series, up }: { series: number[]; up?: boolean }) {
  if (!series.length) return <span className="text-ink-300">—</span>;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || Math.max(max, 1) * 0.02 || 1;
  const color = up === false ? "#f43f5e" : "#10b981";
  const line = series
    .map((v, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * 100;
      const y = 16 - ((v - min) / range) * 12;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg width="72" height="20" viewBox="0 0 100 20" preserveAspectRatio="none" className="inline-block">
      <polyline fill="none" stroke={color} strokeWidth="2" points={line} />
    </svg>
  );
}

function Change({ n }: { n?: number }) {
  if (n == null) return <span className="text-ink-300">—</span>;
  const up = n >= 0;
  return (
    <span className={up ? "text-emerald-600" : "text-rose-600"}>
      {up ? "+" : ""}
      {n.toFixed(2)}%
    </span>
  );
}

export function EcosystemPage() {
  const { data, loading, error } = useAsyncData("ecosystem-v11", loadEcosystemFeed);
  const [filter, setFilter] = useState<EcosystemFilterId>("all");
  const [sortBy, setSortBy] = useState<"tvl" | "change">("tvl");
  const [page, setPage] = useState(1);

  const rows: Row[] = data?.rows ?? [];
  const spark = data?.spark ?? [];
  const stats = data?.stats;

  const filtered = useMemo(() => {
    const meta = ECOSYSTEM_FILTERS.find((f) => f.id === filter);
    let list =
      !meta || filter === "all"
        ? rows
        : rows.filter((r) => meta.match.includes(r.category));
    list = [...list].sort((a, b) =>
      sortBy === "change"
        ? (b.change24h ?? -Infinity) - (a.change24h ?? -Infinity)
        : b.tvlUsd - a.tvlUsd,
    );
    return list;
  }, [rows, filter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  return (
    <div className="space-y-2.5">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        {ECOSYSTEM_FILTERS.map((f) => {
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
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${
                active
                  ? "border-transparent bg-gradient-to-r from-violet-500 to-blue-500 text-white"
                  : "border-ink-200 bg-white text-ink-500 hover:border-arc-400 hover:text-arc-700"
              }`}
            >
              <Icon size={12} />
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="metric-grid xl:grid-cols-6">
        <MetricCard
          label="Total Value Locked"
          value={usd(stats?.tvlUsd ?? 0)}
          change={stats?.tvlChange}
          icon={<Icons.Tvl size={13} />}
          series={spark}
          color="#2563eb"
        />
        <MetricCard
          label="Total Protocols"
          value={compact(rows.length)}
          change={stats?.protocolChange}
          icon={<Icons.Layers size={13} />}
          series={spark}
          color="#8b5cf6"
        />
        <MetricCard
          label="Total 24h Volume"
          value={usd(stats?.volume24h ?? 0)}
          change={stats?.volumeChange}
          icon={<Icons.Volume size={13} />}
          series={spark}
          color="#06b6d4"
        />
        <MetricCard
          label="Total 24h Fees"
          value={usd(stats?.fees24h ?? 0)}
          change={stats?.feesChange}
          icon={<Icons.Fees size={13} />}
          series={spark}
          color="#f59e0b"
        />
        <MetricCard
          label="New Addresses (24h)"
          value={compact(stats?.activeUsers ?? 0)}
          change={stats?.usersChange}
          icon={<Icons.Users size={13} />}
          series={spark}
          color="#10b981"
        />
        <MetricCard
          label="Stablecoins Market Cap"
          value={usd(stats?.stableMcap ?? 0)}
          change={stats?.stableChange}
          icon={<Icons.Stablecoins size={13} />}
          series={spark}
          color="#6366f1"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-0.5">
          <div className="text-[15px] font-semibold text-ink-900">All Protocols</div>
          <div className="flex items-center gap-2 text-[13px]">
            <label className="flex items-center gap-2 text-ink-500">
              Sort
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as "tvl" | "change");
                  setPage(1);
                }}
                className="rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-ink-700 outline-none"
              >
                <option value="tvl">TVL</option>
                <option value="change">24h Change</option>
              </select>
            </label>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 px-2.5 py-1.5 text-ink-500 hover:text-ink-800"
            >
              <Icons.Filter size={14} />
              Filters
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-100 text-[12px] text-ink-500">
                <th className="w-7 py-3 pl-2 pr-0 font-medium">#</th>
                <th className="py-3 pl-1.5 pr-3 font-medium">Protocol</th>
                <th className="px-3 py-3 font-medium">Category</th>
                <th className="px-3 py-3 text-right font-medium">TVL</th>
                <th className="px-3 py-3 text-right font-medium">24h Change</th>
                <th className="px-3 py-3 text-right font-medium">7d Change</th>
                <th className="px-3 py-3 text-right font-medium">1m Change</th>
                <th className="px-3 py-3 text-right font-medium">24h Volume</th>
                <th className="px-3 py-3 text-right font-medium">Fees 24h</th>
                <th className="px-3 py-3 text-right font-medium">Mcap / TVL</th>
                <th className="px-3 py-3 text-right font-medium">Age</th>
                <th className="px-3 py-3 font-medium">Last 7 Days</th>
                <th className="w-10 px-2 py-3" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const rank = (page - 1) * PAGE_SIZE + i + 1;
                return (
                  <tr key={r.slug} className="border-t border-ink-100 hover:bg-ink-50">
                    <td className="w-7 py-3 pl-2 pr-0 align-middle text-ink-400">{rank}</td>
                    <td className="py-3 pl-1.5 pr-3 align-middle">
                      <Link
                        to={`/protocols/${r.slug}`}
                        className="inline-flex max-w-full items-center gap-2 text-[14px] font-semibold text-ink-900 hover:text-arc-700"
                      >
                        <ProtocolIcon slug={r.slug} name={r.name} category={r.category} size={32} />
                        <span className="truncate text-left">{r.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-medium ${
                          CATEGORY_PILL[r.category] ?? "bg-ink-100 text-ink-600"
                        }`}
                      >
                        {CATEGORY_LABELS[r.category as ProtocolCategoryFilter] ?? r.category}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right text-[14px] font-semibold text-ink-900">{usd(r.tvlUsd)}</td>
                    <td className="px-3 py-3 text-right"><Change n={r.change24h} /></td>
                    <td className="px-3 py-3 text-right"><Change n={r.change7d} /></td>
                    <td className="px-3 py-3 text-right"><Change n={r.change1m} /></td>
                    <td className="px-3 py-3 text-right text-ink-700">
                      {r.volume24h != null ? usd(r.volume24h) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-700">
                      {r.fees24h != null ? usd(r.fees24h) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-700">
                      {r.mcapTvl != null ? r.mcapTvl.toFixed(2) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right text-ink-500">{r.age ?? "—"}</td>
                    <td className="px-3 py-3">
                      <MiniSpark
                        series={
                          r.spark7d?.length
                            ? r.spark7d
                            : r.tvlUsd > 0
                              ? [r.tvlUsd * 0.99, r.tvlUsd]
                              : []
                        }
                        up={(r.change7d ?? r.change24h ?? 0) >= 0}
                      />
                    </td>
                    <td className="px-2 py-3 text-ink-300">
                      <Icons.More size={16} />
                    </td>
                  </tr>
                );
              })}
              {!pageRows.length && (
                <tr>
                  <td colSpan={13} className="px-4 py-10 text-center text-ink-400">
                    No protocols in this category yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-ink-100 px-4 pb-2">
          <PageNav
            page={page}
            totalPages={pageCount}
            hasPrev={page > 1}
            hasNext={page < pageCount}
            onPrev={() => setPage((p) => Math.max(1, p - 1))}
            onNext={() => setPage((p) => Math.min(pageCount, p + 1))}
          />
        </div>
      </div>
    </div>
  );
}
