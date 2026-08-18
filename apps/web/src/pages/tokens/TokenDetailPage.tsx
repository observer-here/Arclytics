import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { addresses } from "@arclytics/chain";
import { explorerUrl, getChain } from "@/config/network";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import {
  TokenDistributionChart,
  TokenMcapVolumeChart,
  TokenPriceChart,
} from "@/components/tokens/TokenDetailCharts";
import { Icons } from "@/components/shared/Icons";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { AMM_LABEL, TOKEN_CATEGORY_PILL } from "@/config/tokens";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadTokenDetail } from "@/libs/tokenDetail";
import { isWatched, subscribeWatch, toggleWatch as toggleWatchItem } from "@/libs/watchlist";
import { paths } from "@/routes/paths";
import { ago, compact, pct, shortHash, usd } from "@/utils/format";

const TABS = [
  "Overview",
  "Markets",
  "Holders",
  "Transfers",
  "Contracts",
  "Analytics",
  "Historical Data",
  "News",
] as const;

type Tab = (typeof TABS)[number];

function PanelCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function TableCard({
  title,
  children,
  viewAll,
}: {
  title: string;
  children: ReactNode;
  viewAll?: string;
}) {
  return (
    <div className="table-wrap">
      <div className="flex items-center justify-between border-b border-ink-100 px-2.5 py-2">
        <span className="panel-title">{title}</span>
        {viewAll && (
          <a href={viewAll} target="_blank" rel="noreferrer" className="text-[11px] font-medium text-arc-600 hover:text-arc-700">
            View All
          </a>
        )}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}

const th = "px-3 py-2 text-left text-[11px] font-medium text-ink-400";
const td = "border-t border-ink-100 px-3 py-2 text-[12px] text-ink-700";

export function TokenDetailPage() {
  const { address = "" } = useParams();
  const { data, loading, error } = useAsyncData(
    `token-detail-v5:${address.toLowerCase()}`,
    () => loadTokenDetail(address),
    [address],
  );
  const [tab, setTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);
  const [watched, setWatched] = useState(() => isWatched("token", address));

  useEffect(() => {
    setTab("Overview");
    setWatched(isWatched("token", address));
    return subscribeWatch(() => setWatched(isWatched("token", address)));
  }, [address]);

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;
  if (!data) {
    return <div className="card p-6 text-ink-500">Token not found.</div>;
  }

  const pill = TOKEN_CATEGORY_PILL[data.category as keyof typeof TOKEN_CATEGORY_PILL] ?? TOKEN_CATEGORY_PILL.Other;
  const priceSpark = data.priceSeries.map((p) => p.value);
  const mcapSpark = data.mcapSeries.map((p) => p.value);
  const volSpark = data.volSeries.map((p) => p.value);
  const prices = data.priceSeries.map((p) => p.value).filter((v) => v > 0);
  const ath = prices.length ? Math.max(...prices) : null;
  const atl = prices.length ? Math.min(...prices) : null;
  const scan = explorerUrl(`/token/${data.address}`);
  const chain = getChain();

  const toggleWatch = () => {
    void toggleWatchItem("token", address);
  };

  const copyAddr = async () => {
    try {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // ignore
    }
  };

  const overviewLeft = [
    { k: "Token Name", v: data.name },
    { k: "Symbol", v: data.symbol },
    { k: "Decimals", v: String(data.decimals) },
    { k: "Token Type", v: data.category },
    { k: "Protocol", v: data.protocol },
    { k: "AMM", v: AMM_LABEL[data.amm as keyof typeof AMM_LABEL] ?? data.amm },
    { k: "Blockchain", v: chain.name },
    { k: "Standard", v: "ERC-20" },
  ];

  const overviewRight = [
    { k: "Market Cap Rank", v: data.rank ? `#${data.rank}` : "—" },
    { k: "24h High", v: data.price != null && data.change24h != null ? usd(data.price * (1 + Math.max(0, data.change24h) / 100)) : "—" },
    { k: "24h Low", v: data.price != null && data.change24h != null ? usd(data.price * (1 + Math.min(0, data.change24h) / 100)) : "—" },
    { k: "All Time High", v: ath != null ? usd(ath) : "—" },
    { k: "All Time Low", v: atl != null ? usd(atl) : "—" },
    { k: "Holders", v: compact(data.holdersCount) },
    { k: "24h Transfers", v: compact(data.transfersCount) },
  ];

  const kpis = [
    { label: "Price", value: data.price != null ? usd(data.price) : "—", change: data.change24h, series: priceSpark, color: "#2563eb", icon: <Icons.Tvl size={13} /> },
    { label: "Market Cap", value: data.marketCap != null ? usd(data.marketCap) : "—", change: data.change24h, series: mcapSpark, color: "#8b5cf6", icon: <Icons.Tvl size={13} /> },
    { label: "Fully Diluted Valuation", value: data.fdv != null ? usd(data.fdv) : "—", change: undefined, series: mcapSpark, color: "#06b6d4", icon: <Icons.Layers size={13} /> },
    { label: "24h Volume", value: data.volume24h != null && data.volume24h > 0 ? usd(data.volume24h) : "—", change: data.change24h, series: volSpark, color: "#10b981", icon: <Icons.Volume size={13} /> },
    { label: "Circulating Supply", value: data.circulating > 0 ? compact(data.circulating) : "—", change: undefined, series: [], color: "#f59e0b", icon: <Icons.Tokens size={13} /> },
    { label: "Total Supply", value: data.supply > 0 ? compact(data.supply) : "—", change: undefined, series: [], color: "#64748b", icon: <Icons.Tokens size={13} /> },
  ];

  const showOverview = tab === "Overview";

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <Link to={paths.tokens} className="hover:text-arc-600">
          Tokens
        </Link>
        <span>/</span>
        <span className="text-ink-700">
          {data.name} ({data.symbol})
        </span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <TokenIcon address={data.address} src={data.iconUrl} symbol={data.symbol} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-ink-900">{data.name}</h1>
              <span className="text-[14px] font-medium text-ink-400">{data.symbol}</span>
              <Icons.Verified size={18} className="text-sky-500" />
              <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${pill}`}>{data.category}</span>
            </div>
            <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-ink-500">
              {data.blurb ??
                `${data.name} is a ${data.category.toLowerCase()} token on ${chain.name}${data.protocol !== "—" ? `, associated with ${data.protocol}` : ""}.`}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="font-mono text-[11px] text-ink-500">{shortHash(data.address, 10, 8)}</span>
              <button
                type="button"
                onClick={copyAddr}
                className="rounded-md border border-ink-200 bg-white px-2 py-0.5 text-[10px] font-medium text-ink-500 hover:border-arc-400 hover:text-arc-700"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <a href={scan} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-arc-600">
                <Icons.X size={14} />
              </a>
              <a href={scan} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-arc-600">
                <Icons.Globe size={14} />
              </a>
              <a href={scan} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-arc-600">
                <Icons.Discord size={14} />
              </a>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={toggleWatch}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400"
          >
            {watched ? <Icons.StarFilled size={14} className="text-amber-500" /> : <Icons.Star size={14} />}
            {watched ? "Watchlisted" : "Add to Watchlist"}
          </button>
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400"
          >
            <Icons.Share size={14} /> Share
          </button>
        </div>
      </div>

      <div className="metric-grid xl:grid-cols-6">
        {kpis.map((k) => (
          <MetricCard
            key={k.label}
            label={k.label}
            value={k.value}
            change={k.change ?? undefined}
            series={k.series}
            icon={k.icon}
            color={k.color}
          />
        ))}
      </div>

      <div className="flex gap-0.5 overflow-x-auto border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2.5 text-[12px] font-medium transition ${
              tab === t ? "border-arc-600 text-arc-700" : "border-transparent text-ink-400 hover:text-ink-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {showOverview && (
        <div className="grid gap-3 xl:grid-cols-5">
          <div className="space-y-3 xl:col-span-3">
            <TokenPriceChart data={data.priceSeries} />
            <TokenMcapVolumeChart mcap={data.mcapSeries} volume={data.volSeries} />
            <TableCard title="Recent Transfers" viewAll={scan}>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={th}>Tx Hash</th>
                    <th className={th}>From</th>
                    <th className={th}>To</th>
                    <th className={`${th} text-right`}>Amount</th>
                    <th className={`${th} text-right`}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.transfers.length ? (
                    data.transfers.slice(0, 8).map((tx, i) => {
                      const hash = String(tx.transaction_hash ?? tx.tx_hash ?? "");
                      const from = String((tx.from as { hash?: string } | undefined)?.hash ?? "");
                      const to = String((tx.to as { hash?: string } | undefined)?.hash ?? "");
                      const raw = (tx.total as { value?: string | number } | undefined)?.value ?? tx.value;
                      const amt = Number(raw ?? 0) / 10 ** data.decimals;
                      const ts = String(tx.timestamp ?? "");
                      return (
                        <tr key={`${hash}-${i}`}>
                          <td className={td}>
                            <a href={explorerUrl(`/tx/${hash}`)} target="_blank" rel="noreferrer" className="font-mono text-arc-700 hover:underline">
                              {shortHash(hash)}
                            </a>
                          </td>
                          <td className={`${td} font-mono text-[11px]`}>{shortHash(from, 6, 4)}</td>
                          <td className={`${td} font-mono text-[11px]`}>{shortHash(to, 6, 4)}</td>
                          <td className={`${td} text-right font-medium text-ink-800`}>
                            {Number.isFinite(amt) ? `${compact(amt)} ${data.symbol}` : "—"}
                          </td>
                          <td className={`${td} text-right text-ink-500`}>{ts ? ago(ts) : "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-ink-400">
                        No transfers indexed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableCard>
          </div>

          <div className="space-y-3 xl:col-span-2">
            <PanelCard className="p-3">
              <div className="panel-title mb-2">Token Overview</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-0">
                  {overviewLeft.map((r) => (
                    <div key={r.k} className="flex justify-between gap-2 border-b border-ink-100 py-1.5 text-[11px]">
                      <span className="text-ink-400">{r.k}</span>
                      <span className="text-right font-medium text-ink-800">{r.v}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2 py-1.5 text-[11px]">
                    <span className="text-ink-400">Contract</span>
                    <a href={scan} target="_blank" rel="noreferrer" className="font-mono text-arc-700 hover:underline">
                      {shortHash(data.address, 6, 4)}
                    </a>
                  </div>
                </div>
                <div className="space-y-0">
                  {overviewRight.map((r) => (
                    <div key={r.k} className="flex justify-between gap-2 border-b border-ink-100 py-1.5 text-[11px]">
                      <span className="text-ink-400">{r.k}</span>
                      <span className="text-right font-medium text-ink-800">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </PanelCard>

            <TokenDistributionChart
              slices={data.holderSlices}
              center={data.supply > 0 ? compact(data.supply) : "—"}
            />

            <TableCard title="Top Holders" viewAll={scan}>
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>Address</th>
                    <th className={`${th} text-right`}>Balance</th>
                    <th className={`${th} text-right`}>% Supply</th>
                  </tr>
                </thead>
                <tbody>
                  {data.holders.length ? (
                    data.holders.slice(0, 6).map((h, i) => {
                      const addr = String((h.address as { hash?: string } | undefined)?.hash ?? h.address_hash ?? "");
                      const bal = Number(h.value ?? 0) / 10 ** data.decimals;
                      const share = data.supply > 0 ? (bal / data.supply) * 100 : 0;
                      return (
                        <tr key={`${addr}-${i}`}>
                          <td className={`${td} text-ink-400`}>{i + 1}</td>
                          <td className={td}>
                            <a href={explorerUrl(`/address/${addr}`)} target="_blank" rel="noreferrer" className="font-mono text-arc-700 hover:underline">
                              {shortHash(addr, 8, 6)}
                            </a>
                          </td>
                          <td className={`${td} text-right font-medium text-ink-800`}>{compact(bal)}</td>
                          <td className={`${td} text-right text-ink-500`}>{share > 0 ? `${share.toFixed(2)}%` : "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-ink-400">
                        No holders indexed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableCard>

            <TableCard title="Markets">
              <table className="w-full text-left">
                <thead>
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>Pair</th>
                    <th className={`${th} text-right`}>Price</th>
                    <th className={`${th} text-right`}>24h Volume</th>
                    <th className={`${th} text-right`}>24h %</th>
                    <th className={`${th} text-right`}>Liquidity</th>
                  </tr>
                </thead>
                <tbody>
                  {data.markets.length ? (
                    data.markets.map((m, i) => (
                      <tr key={m.pair}>
                        <td className={`${td} text-ink-400`}>{i + 1}</td>
                        <td className={td}>
                          <span className="inline-flex items-center gap-1.5 font-medium text-ink-800">
                            <TokenIcon address={data.address} src={data.iconUrl} symbol={data.symbol} size={18} />
                            <TokenIcon address={addresses.usdc} symbol="USDC" size={18} />
                            <span className="ml-0.5">{m.pair}</span>
                          </span>
                        </td>
                        <td className={`${td} text-right`}>{m.price != null ? usd(m.price) : "—"}</td>
                        <td className={`${td} text-right`}>{m.volume24h != null && m.volume24h > 0 ? usd(m.volume24h) : "—"}</td>
                        <td className={`${td} text-right`}>
                          {m.change24h != null ? (
                            <span className={m.change24h >= 0 ? "text-emerald-600" : "text-rose-600"}>{pct(m.change24h)}</span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`${td} text-right`}>{m.liquidity != null && m.liquidity > 0 ? usd(m.liquidity) : "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-ink-400">
                        No markets indexed.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </TableCard>
          </div>
        </div>
      )}

      {tab !== "Overview" && (
        <PanelCard className="p-8 text-center text-[13px] text-ink-400">
          {tab} view — open Overview for full dashboard.
        </PanelCard>
      )}

      <div className="text-center text-[10px] text-ink-400">Data provided by ArcScan API · Updated live</div>
    </div>
  );
}
