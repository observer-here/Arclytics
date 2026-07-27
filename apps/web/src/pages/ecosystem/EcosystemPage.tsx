import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { Icons } from "@/components/shared/Icons";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import {
  CATEGORY_ACCENT,
  CATEGORY_PILL,
  ECOSYSTEM_FILTERS,
  type EcosystemFilterId,
} from "@/config/ecosystem";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadEcosystem } from "@/libs/prefetch";
import { paths } from "@/routes/paths";
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
};

function Spark({ series, color }: { series: number[]; color: string }) {
  const max = Math.max(...series, 1);
  const line = series
    .map((v, i) => `${(i / Math.max(series.length - 1, 1)) * 100},${36 - (v / max) * 28}`)
    .join(" ");
  const area = `0,40 ${line} 100,40`;
  const id = `c-${color.replace("#", "")}`;
  return (
    <svg className="mt-3 w-full" height="40" viewBox="0 0 100 40" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
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
  const { data, loading, error } = useAsyncData("ecosystem", loadEcosystem);
  const [filter, setFilter] = useState<EcosystemFilterId>("all");
  const [sortBy, setSortBy] = useState<"tvl" | "change">("tvl");

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
        ? (b.change24h ?? 0) - (a.change24h ?? 0)
        : b.tvlUsd - a.tvlUsd,
    );
    return list;
  }, [rows, filter, sortBy]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { tvl: number; count: number }>();
    for (const r of rows) {
      const cur = map.get(r.category) ?? { tvl: 0, count: 0 };
      cur.tvl += r.tvlUsd;
      cur.count += 1;
      map.set(r.category, cur);
    }
    return [...map.entries()]
      .map(([category, v]) => ({ category, ...v }))
      .sort((a, b) => b.tvl - a.tvl);
  }, [rows]);

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {ECOSYSTEM_FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-medium transition ${
                active
                  ? "border-transparent bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm"
                  : "border-ink-200 bg-white text-ink-500 hover:border-arc-400 hover:text-arc-700"
              }`}
            >
              <Icon size={13} />
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Total VLocked"
          value={usd(stats?.tvlUsd ?? 0)}
          change={stats?.tvlChange}
          icon={<Icons.Tvl size={15} />}
          series={spark}
          color="#2563eb"
          iconBg="bg-blue-50 text-blue-600"
        />
        <MetricCard
          label="Protocols"
          value={compact(rows.length)}
          change={stats?.protocolChange}
          icon={<Icons.Layers size={15} />}
          series={spark}
          color="#8b5cf6"
          iconBg="bg-violet-50 text-violet-600"
        />
        <MetricCard
          label="24h Volume"
          value={usd(stats?.volume24h ?? 0)}
          change={stats?.volumeChange}
          icon={<Icons.Volume size={15} />}
          series={spark}
          color="#06b6d4"
          iconBg="bg-cyan-50 text-cyan-600"
        />
        <MetricCard
          label="Fees 24h"
          value={usd(stats?.fees24h ?? 0)}
          change={stats?.feesChange}
          icon={<Icons.Fees size={15} />}
          series={spark}
          color="#f59e0b"
          iconBg="bg-amber-50 text-amber-600"
        />
        <MetricCard
          label="Active Users"
          value={compact(stats?.activeUsers ?? 0)}
          change={stats?.usersChange}
          icon={<Icons.Users size={15} />}
          series={spark}
          color="#10b981"
          iconBg="bg-emerald-50 text-emerald-600"
        />
        <MetricCard
          label="Transactions"
          value={compact(stats?.transactions ?? 0)}
          change={stats?.txChange}
          icon={<Icons.Tx size={15} />}
          series={spark}
          color="#6366f1"
          iconBg="bg-indigo-50 text-indigo-600"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-100 px-3 py-2.5">
          <div className="panel-title">Top Protocols</div>
          <div className="flex items-center gap-2 text-[12px]">
            <label className="flex items-center gap-1 text-ink-500">
              Sort
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "tvl" | "change")}
                className="rounded-md border border-ink-200 bg-white px-2 py-1 text-ink-700 outline-none"
              >
                <option value="tvl">TVL</option>
                <option value="change">24h Change</option>
              </select>
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left text-[13px]">
            <thead>
              <tr className="text-[11px] text-ink-400">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Protocol</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 text-right font-medium">TVL</th>
                <th className="px-3 py-2 text-right font-medium">24h Change</th>
                <th className="px-3 py-2 text-right font-medium">7d Change</th>
                <th className="px-3 py-2 text-right font-medium">1m Change</th>
                <th className="px-3 py-2 text-right font-medium">24h Volume</th>
                <th className="px-3 py-2 text-right font-medium">Fees 24h</th>
                <th className="px-3 py-2 text-right font-medium">Mcap / TVL</th>
                <th className="px-3 py-2 text-right font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr key={r.slug} className="border-t border-ink-100 hover:bg-ink-50/70">
                  <td className="px-3 py-2.5 text-ink-400">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <Link
                      to={`/protocols/${r.slug}`}
                      className="flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                    >
                      <span
                        className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${CATEGORY_ACCENT[r.category] ?? "#64748b"}, #2563eb)`,
                        }}
                      >
                        {r.name.slice(0, 1)}
                      </span>
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        CATEGORY_PILL[r.category] ?? "bg-ink-100 text-ink-600"
                      }`}
                    >
                      {CATEGORY_LABELS[r.category as ProtocolCategoryFilter] ?? r.category}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-medium">{usd(r.tvlUsd)}</td>
                  <td className="px-3 py-2.5 text-right"><Change n={r.change24h} /></td>
                  <td className="px-3 py-2.5 text-right"><Change n={r.change7d} /></td>
                  <td className="px-3 py-2.5 text-right"><Change n={r.change1m} /></td>
                  <td className="px-3 py-2.5 text-right text-ink-600">
                    {r.volume24h != null ? usd(r.volume24h) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-600">
                    {r.fees24h != null ? usd(r.fees24h) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-600">
                    {r.mcapTvl != null ? r.mcapTvl.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-ink-500">{r.age ?? "—"}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-ink-400">
                    No protocols in this category yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-ink-100 py-2.5 text-center">
          <Link to={paths.protocols} className="text-[13px] font-medium text-arc-600 hover:text-arc-700">
            View All Protocols →
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {byCategory.slice(0, 6).map((c) => {
          const color = CATEGORY_ACCENT[c.category] ?? "#64748b";
          const Icon =
            ECOSYSTEM_FILTERS.find((f) => f.match.includes(c.category))?.icon ?? Icons.Layers;
          return (
            <div key={c.category} className="card p-3.5">
              <div
                className="mb-3 grid h-11 w-11 place-items-center rounded-full text-white"
                style={{ background: `linear-gradient(135deg, ${color}, #2563eb)` }}
              >
                <Icon size={18} />
              </div>
              <div className="text-[13px] font-semibold text-ink-900">
                {CATEGORY_LABELS[c.category as ProtocolCategoryFilter] ?? c.category}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-base font-semibold text-ink-900">{usd(c.tvl)}</span>
              </div>
              <Spark series={spark.length ? spark : [1, 2, 1.5, 3, 2.2, 4]} color={color} />
              <div className="mt-2 text-[11px] text-ink-400">
                {c.count} protocol{c.count === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
