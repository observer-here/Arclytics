import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { DonutChart } from "@/components/charts/Charts";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import { Icons } from "@/components/shared/Icons";
import { TokenIcon } from "@/components/shared/TokenIcon";
import {
  LEGIT_TOKENS,
  TOKEN_CATEGORY_PILL,
  TOKEN_FILTERS,
  type TokenCategory,
  type TokenFilterId,
} from "@/config/tokens";
import { useAsyncData } from "@/hooks/useAsyncData";
import { arcscan } from "@/libs/arcscan";
import { compact, usd } from "@/utils/format";

type TokenRow = {
  address: string;
  name: string;
  symbol: string;
  holders: number;
  iconUrl?: string;
  price: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  volume24h: number | null;
  category: TokenCategory;
  protocol?: string;
};

function mapToken(
  t: Record<string, unknown>,
  meta: (typeof LEGIT_TOKENS)[number],
): TokenRow | null {
  const address = String(t.address_hash ?? meta.address);
  const name = String(t.name ?? "");
  const symbol = String(t.symbol ?? "");
  if (!name && !symbol) return null;

  const rate = t.exchange_rate != null ? Number(t.exchange_rate) : null;
  const price =
    rate != null && Number.isFinite(rate) && rate > 0
      ? rate
      : meta.pegUsd
        ? 1
        : null;

  const mcapRaw = t.circulating_market_cap != null ? Number(t.circulating_market_cap) : null;
  const marketCap =
    mcapRaw != null && Number.isFinite(mcapRaw) && mcapRaw > 0 ? mcapRaw : null;
  const vol = t.volume_24h != null ? Number(t.volume_24h) : null;

  return {
    address,
    name,
    symbol,
    holders: Number(t.holders_count ?? 0),
    iconUrl: t.icon_url ? String(t.icon_url) : undefined,
    price,
    change24h: price != null ? 0 : null,
    change7d: price != null ? 0 : null,
    marketCap,
    volume24h: vol != null && Number.isFinite(vol) ? vol : null,
    category: meta.category,
    protocol: meta.protocol,
  };
}

function Change({ n }: { n?: number | null }) {
  if (n == null) return <span className="text-ink-300">—</span>;
  const up = n >= 0;
  return (
    <span className={`font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "+" : ""}
      {n.toFixed(2)}%
    </span>
  );
}

export function TokensPage() {
  const [filter, setFilter] = useState<TokenFilterId>("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"holders" | "name" | "mcap">("holders");

  const { data, loading, error } = useAsyncData("tokens-legit-v3", async () => {
    const settled = await Promise.all(
      LEGIT_TOKENS.map(async (meta) => {
        const t = await arcscan.token(meta.address).catch(() => null);
        if (!t || (t as { message?: string }).message) return null;
        return mapToken(t, meta);
      }),
    );
    return settled.filter((r): r is TokenRow => Boolean(r));
  });

  const rows = Array.isArray(data) ? data : [];

  const filtered = useMemo(() => {
    const metaF = TOKEN_FILTERS.find((f) => f.id === filter);
    let list = rows;
    if (metaF && metaF.match !== "all") {
      list = list.filter((r) => (metaF.match as TokenCategory[]).includes(r.category));
    }
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (r) =>
          r.name.toLowerCase().includes(query) ||
          r.symbol.toLowerCase().includes(query) ||
          r.address.toLowerCase().includes(query) ||
          (r.protocol ?? "").toLowerCase().includes(query),
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "mcap") return (b.marketCap ?? 0) - (a.marketCap ?? 0);
      return b.holders - a.holders;
    });
  }, [rows, filter, q, sortBy]);

  const stats = useMemo(() => {
    const holders = rows.reduce((s, r) => s + r.holders, 0);
    const mcap = rows.reduce((s, r) => s + (r.marketCap ?? 0), 0);
    const vol = rows.reduce((s, r) => s + (r.volume24h ?? 0), 0);
    const active = rows.filter((r) => r.holders > 0).length;
    return { holders, mcap, vol, active, count: rows.length };
  }, [rows]);

  const distribution = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(r.category, (map.get(r.category) ?? 0) + Math.max(r.holders, 1));
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [rows]);

  const topHolders = filtered.slice(0, 5);
  const lowHolders = [...filtered].reverse().slice(0, 5);

  if (loading && !rows.length) {
    return <div className="text-sm text-ink-400">Loading…</div>;
  }
  if (error && !rows.length) {
    return <div className="text-sm text-ink-400">{error}</div>;
  }

  return (
    <div className="space-y-2.5">
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {TOKEN_FILTERS.map((f) => {
          const Icon = f.icon;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
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

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          label="Tracked Market Cap"
          value={stats.mcap > 0 ? usd(stats.mcap) : "—"}
          icon={<Icons.Tvl size={13} />}
          color="#2563eb"
        />
        <MetricCard
          label="Tracked Volume (24h)"
          value={stats.vol > 0 ? usd(stats.vol) : "—"}
          icon={<Icons.Volume size={13} />}
          color="#8b5cf6"
        />
        <MetricCard
          label="Legit Tokens"
          value={compact(stats.count)}
          icon={<Icons.Tokens size={13} />}
          color="#06b6d4"
        />
        <MetricCard
          label="Active Tokens"
          value={compact(stats.active)}
          icon={<Icons.Activity size={13} />}
          color="#10b981"
        />
        <MetricCard
          label="Holders"
          value={compact(stats.holders)}
          icon={<Icons.Users size={13} />}
          color="#f59e0b"
        />
        <MetricCard
          label="Protocols Linked"
          value={compact(new Set(rows.map((r) => r.protocol).filter(Boolean)).size)}
          icon={<Icons.Layers size={13} />}
          color="#f43f5e"
        />
      </div>

      <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white p-2">
            <div className="relative min-w-[180px] flex-1">
              <Icons.Search
                size={14}
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search token by name..."
                className="w-full rounded-md border border-ink-200 bg-white py-1.5 pl-8 pr-2.5 text-[13px] text-ink-800 outline-none placeholder:text-ink-400 focus:border-arc-400"
              />
            </div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as TokenFilterId)}
              className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] text-ink-600"
            >
              {TOKEN_FILTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] text-ink-600"
            >
              <option value="holders">Sort by: Holders</option>
              <option value="mcap">Sort by: Market Cap</option>
              <option value="name">Sort by: Name</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left text-[13px]">
                <thead>
                  <tr className="border-b border-ink-100 bg-ink-50/60">
                    <th className="w-8 py-2.5 pl-3 pr-0 text-[11px] font-medium text-ink-400">#</th>
                    <th className="py-2.5 pl-2 pr-3 text-[11px] font-medium text-ink-400">Token</th>
                    <th className="px-3 py-2.5 text-[11px] font-medium text-ink-400">Protocol</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">Price</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">24h %</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">7d %</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">Market Cap</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">Volume</th>
                    <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">Holders</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.address} className="border-t border-ink-100 hover:bg-ink-50/50">
                      <td className="w-8 py-2.5 pl-3 pr-0 align-middle text-[13px] text-ink-400">
                        {i + 1}
                      </td>
                      <td className="py-2.5 pl-2 pr-3 align-middle">
                        <Link
                          to={`/tokens/${r.address}`}
                          className="inline-flex max-w-full items-center gap-2.5 text-[14px] font-semibold text-ink-900 hover:text-arc-700"
                        >
                          <TokenIcon src={r.iconUrl} symbol={r.symbol} size={28} />
                          <span className="min-w-0 text-left">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate">{r.name || r.symbol}</span>
                              <span
                                className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium ${TOKEN_CATEGORY_PILL[r.category]}`}
                              >
                                {r.category}
                              </span>
                            </span>
                            <span className="mt-0.5 block text-left text-[12px] font-normal text-ink-400">
                              {r.symbol}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-2.5 text-[13px] text-ink-500">{r.protocol ?? "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-800">
                        {r.price != null ? usd(r.price) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px]">
                        <Change n={r.change24h} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px]">
                        <Change n={r.change7d} />
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-800">
                        {r.marketCap != null ? usd(r.marketCap) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px] text-ink-700">
                        {r.volume24h != null ? usd(r.volume24h) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-800">
                        {compact(r.holders)}
                      </td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-ink-400">
                        No legit tokens found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <DonutChart
            title="Category Distribution"
            slices={distribution}
            colors={["#3b82f6", "#10b981", "#14b8a6", "#64748b"]}
          />

          <div className="rounded-lg border border-ink-200 bg-white p-2.5">
            <div className="mb-2 text-[13px] font-semibold text-ink-900">Top by Holders</div>
            <div className="space-y-1.5">
              {topHolders.map((r, i) => (
                <Link
                  key={r.address}
                  to={`/tokens/${r.address}`}
                  className="flex items-center gap-2 rounded-md border border-ink-100 px-2 py-1.5 hover:border-arc-300"
                >
                  <span className="w-4 text-[11px] text-ink-400">{i + 1}</span>
                  <TokenIcon src={r.iconUrl} symbol={r.symbol} size={22} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-800">
                    {r.symbol || r.name}
                  </span>
                  <span className="text-[11px] text-ink-500">{compact(r.holders)}</span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-ink-200 bg-white p-2.5">
            <div className="mb-2 text-[13px] font-semibold text-ink-900">Smaller Caps</div>
            <div className="space-y-1.5">
              {lowHolders.map((r, i) => (
                <Link
                  key={r.address}
                  to={`/tokens/${r.address}`}
                  className="flex items-center gap-2 rounded-md border border-ink-100 px-2 py-1.5 hover:border-arc-300"
                >
                  <span className="w-4 text-[11px] text-ink-400">{i + 1}</span>
                  <TokenIcon src={r.iconUrl} symbol={r.symbol} size={22} />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink-800">
                    {r.symbol || r.name}
                  </span>
                  <span className="text-[11px] text-ink-500">{compact(r.holders)}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
