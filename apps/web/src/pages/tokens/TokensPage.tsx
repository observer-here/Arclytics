import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import { Icons } from "@/components/shared/Icons";
import { TokenIcon } from "@/components/shared/TokenIcon";
import {
  AMM_LABEL,
  TOKEN_CATEGORY_PILL,
  TOKEN_FILTERS,
  type AmmKind,
  type TokenCategory,
  type TokenFilterId,
} from "@/config/tokens";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getTokens, type TokenFeedRow } from "@/libs/api";
import { paths } from "@/routes/paths";
import { compact, usd } from "@/utils/format";

type TokenRow = TokenFeedRow & {
  category: TokenCategory;
  amm: AmmKind;
};

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

function asRow(r: TokenFeedRow): TokenRow {
  return {
    ...r,
    category: r.category as TokenCategory,
    amm: r.amm as AmmKind,
    change24h: r.change24h ?? null,
    change7d: r.change7d ?? null,
  };
}

export function TokensPage() {
  const [filter, setFilter] = useState<TokenFilterId>("all");
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<"interest" | "holders" | "name" | "mcap">(
    "interest",
  );

  const { data, loading, error } = useAsyncData("tokens-api-v3", async () => {
    const feed = await getTokens();
    return (feed.items ?? []).map(asRow);
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
          (r.protocol ?? "").toLowerCase().includes(query) ||
          (AMM_LABEL[r.amm] ?? "").toLowerCase().includes(query),
      );
    }
    return [...list].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "mcap") return (b.marketCap ?? 0) - (a.marketCap ?? 0);
      if (sortBy === "holders") return b.holders - a.holders;
      return b.interest - a.interest;
    });
  }, [rows, filter, q, sortBy]);

  const stats = useMemo(() => {
    const holders = rows.reduce((s, r) => s + r.holders, 0);
    const transfers = rows.reduce((s, r) => s + r.transfers, 0);
    const mcap = rows.reduce((s, r) => s + (r.marketCap ?? 0), 0);
    const vol = rows.reduce((s, r) => s + (r.volume24h ?? 0), 0);
    const active = rows.filter((r) => r.holders > 0).length;
    const top = [...rows].sort((a, b) => b.interest - a.interest)[0];
    return { holders, transfers, mcap, vol, active, count: rows.length, topSymbol: top?.symbol };
  }, [rows]);

  if (loading && !rows.length) {
    return <div className="text-sm text-ink-400">Loading…</div>;
  }
  if (error && !rows.length) {
    return <div className="text-sm text-ink-400">{error}</div>;
  }

  return (
    <div className="space-y-2.5">
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
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

      <div className="metric-grid xl:grid-cols-7">
        <Link to={paths.tokensMarketCap} className="block transition hover:opacity-90">
          <MetricCard
            label="Tracked Market Cap"
            value={stats.mcap > 0 ? usd(stats.mcap) : "—"}
            icon={<Icons.Tvl size={13} />}
            color="#2563eb"
          />
        </Link>
        <MetricCard
          label="Volume (24h)"
          value={stats.vol > 0 ? usd(stats.vol) : "—"}
          icon={<Icons.Volume size={13} />}
          color="#0ea5e9"
        />
        <MetricCard
          label="Total Transfers"
          value={compact(stats.transfers)}
          icon={<Icons.Activity size={13} />}
          color="#8b5cf6"
        />
        <MetricCard
          label="Tracked Tokens"
          value={compact(stats.count)}
          icon={<Icons.Tokens size={13} />}
          color="#06b6d4"
        />
        <MetricCard
          label="Active Tokens"
          value={compact(stats.active)}
          icon={<Icons.DeFi size={13} />}
          color="#10b981"
        />
        <MetricCard
          label="Holders"
          value={compact(stats.holders)}
          icon={<Icons.Users size={13} />}
          color="#f59e0b"
        />
        <MetricCard
          label="Top Interest"
          value={stats.topSymbol ?? "—"}
          icon={<Icons.Layers size={13} />}
          color="#f43f5e"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-ink-200 bg-white p-2">
        <div className="relative min-w-[180px] flex-1">
          <Icons.Search
            size={14}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search token, protocol, AMM..."
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
          <option value="interest">Sort by: Interest</option>
          <option value="holders">Sort by: Holders</option>
          <option value="mcap">Sort by: Market Cap</option>
          <option value="name">Sort by: Name</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full table-auto text-left text-[13px]">
            <thead>
              <tr className="border-b border-ink-100 bg-ink-50">
                <th className="w-8 py-2.5 pl-3 pr-0 text-[11px] font-medium text-ink-400">#</th>
                <th className="py-2.5 pl-2 pr-3 text-[11px] font-medium text-ink-400">Token</th>
                <th className="px-3 py-2.5 text-[11px] font-medium text-ink-400">Protocol</th>
                <th className="px-3 py-2.5 text-[11px] font-medium text-ink-400">AMM</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">Price</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">24h %</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">7d %</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">Market Cap</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">Volume (24h)</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium text-ink-400">Transfers</th>
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
                      <TokenIcon address={r.address} src={r.iconUrl} symbol={r.symbol} size={28} />
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
                  <td className="px-3 py-2.5 text-[12px] text-ink-500">
                    {AMM_LABEL[r.amm] ?? r.amm}
                  </td>
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
                    {r.volume24h != null && r.volume24h > 0 ? usd(r.volume24h) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] text-ink-700">
                    {r.transfers > 0 ? compact(r.transfers) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[13px] font-semibold text-ink-800">
                    {compact(r.holders)}
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={11} className="px-3 py-10 text-center text-ink-400">
                    No tokens found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
