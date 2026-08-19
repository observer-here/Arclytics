import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { Skel } from "@/components/shared/Skel";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { AMM_LABEL, TOKEN_CATEGORY_PILL } from "@/config/tokens";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  buildMarkets,
  composeTokenCharts,
  holderDistribution,
  loadTokenCounts,
  loadTokenFeed,
  loadTokenHolderList,
  loadTokenPriceFallback,
  loadTokenPriceRatios,
  loadTokenSupply,
  loadTokenTransferList,
  loadTokenVolumeBuckets,
  resolveVolume24h,
} from "@/libs/tokenDetail";
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

function Val({ ready, children, w = "w-16" }: { ready: boolean; children: ReactNode; w?: string }) {
  if (!ready) return <Skel className={`h-3 ${w}`} />;
  return <span className="text-right font-medium text-ink-800">{children}</span>;
}

export function TokenDetailPage() {
  const { address = "" } = useParams();
  const key = address.toLowerCase();

  // Every section fetches on its own — no hook waits for another.
  const feedQ = useAsyncData(`tk-feed:${key}`, () => loadTokenFeed(address), [address]);
  const supplyQ = useAsyncData(`tk-supply:${key}`, () => loadTokenSupply(address), [address]);
  const fallbackQ = useAsyncData(`tk-pxfb:${key}`, () => loadTokenPriceFallback(address), [address]);
  const countsQ = useAsyncData(`tk-counts:${key}`, () => loadTokenCounts(address), [address]);
  const holdersQ = useAsyncData(`tk-holders:${key}`, () => loadTokenHolderList(address), [address]);
  const transfersQ = useAsyncData(`tk-transfers:${key}`, () => loadTokenTransferList(address), [address]);
  const ratiosQ = useAsyncData(`tk-ratios:${key}`, () => loadTokenPriceRatios(address), [address]);
  const bucketsQ = useAsyncData(`tk-buckets:${key}`, () => loadTokenVolumeBuckets(address), [address]);

  const feed = feedQ.data;
  const supplyInfo = supplyQ.data;
  const counts = countsQ.data;

  const [tab, setTab] = useState<Tab>("Overview");
  const [copied, setCopied] = useState(false);
  const [watched, setWatched] = useState(() => isWatched("token", address));

  useEffect(() => {
    setTab("Overview");
    setWatched(isWatched("token", address));
    return subscribeWatch(() => setWatched(isWatched("token", address)));
  }, [address]);

  // Prefer the DB feed (fast); fill the gaps from ArcScan as it lands.
  const name = feed?.name ?? supplyInfo?.name;
  const symbol = feed?.symbol ?? supplyInfo?.symbol;
  const iconUrl = feed?.iconUrl ?? supplyInfo?.iconUrl;
  const tokenAddress = feed?.address ?? supplyInfo?.address;
  const price = feed?.price ?? fallbackQ.data?.price ?? supplyInfo?.exchangeRate ?? null;
  const change24h = feed?.change24h ?? null;
  const supply = supplyInfo?.supply ?? 0;
  const circulating = supplyInfo?.circulating ?? 0;
  const snapSupply = circulating > 0 ? circulating : supply;
  const marketCap =
    feed?.marketCap ??
    supplyInfo?.marketCap ??
    (price != null && price > 0 && snapSupply > 0 ? price * snapSupply : null);
  const fdv = price != null && supply > 0 ? price * supply : null;
  const holdersCount = counts?.holdersCount ?? feed?.holdersCount ?? null;
  const transfersCount = counts?.transfersCount ?? feed?.transfersCount ?? null;
  const volume24h = resolveVolume24h(feed?.volume24h ?? null, bucketsQ.data, price);
  const identityReady = Boolean(name);

  const charts = useMemo(
    () =>
      composeTokenCharts({
        price,
        change24h,
        marketCap,
        supply: snapSupply,
        isSpot: feed?.isSpot ?? false,
        ratios: ratiosQ.data,
        buckets: bucketsQ.data,
      }),
    [price, change24h, marketCap, snapSupply, feed?.isSpot, ratiosQ.data, bucketsQ.data],
  );

  const holderSlices = useMemo(
    () => (holdersQ.data && supplyInfo ? holderDistribution(holdersQ.data, supplyInfo.supply, supplyInfo.decimals) : []),
    [holdersQ.data, supplyInfo],
  );

  const markets = useMemo(
    () => buildMarkets(address, symbol ?? "", price, volume24h, change24h, fallbackQ.data?.tvlUsd ?? null),
    [address, symbol, price, volume24h, change24h, fallbackQ.data],
  );

  if (!feedQ.loading && !supplyQ.loading && !feed && !supplyInfo) {
    return <div className="card p-6 text-ink-500">Token not found.</div>;
  }

  const chain = getChain();
  const category = feed?.category ?? "Other";
  const pill = TOKEN_CATEGORY_PILL[category as keyof typeof TOKEN_CATEGORY_PILL] ?? TOKEN_CATEGORY_PILL.Other;
  const scan = tokenAddress ? explorerUrl(`/token/${tokenAddress}`) : "#";
  const prices = charts.priceSeries.map((p) => p.value).filter((v) => v > 0);
  const chartsLoading = ratiosQ.loading || bucketsQ.loading;
  const chartsReady = !chartsLoading && Boolean(charts.priceSeries.length);

  const toggleWatch = () => void toggleWatchItem("token", address);

  const copyAddr = async () => {
    if (!tokenAddress) return;
    try {
      await navigator.clipboard.writeText(tokenAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch { /* clipboard unavailable */ }
  };

  // Price, market cap, volume and change all come from the DB feed, so these
  // cards only wait on that one backend request.
  const kpis = [
    { label: "Price", value: price != null ? usd(price) : "—", change: change24h, series: charts.priceSeries.map((p) => p.value), color: "#2563eb", icon: <Icons.Tvl size={13} />, ready: !feedQ.loading },
    { label: "Market Cap", value: marketCap != null ? usd(marketCap) : "—", change: change24h, series: charts.mcapSeries.map((p) => p.value), color: "#8b5cf6", icon: <Icons.Tvl size={13} />, ready: !feedQ.loading },
    { label: "Fully Diluted Valuation", value: fdv != null ? usd(fdv) : "—", change: undefined, series: charts.mcapSeries.map((p) => p.value), color: "#06b6d4", icon: <Icons.Layers size={13} />, ready: !feedQ.loading && !supplyQ.loading },
    { label: "24h Volume", value: volume24h != null ? usd(volume24h) : "—", change: change24h, series: charts.volSeries.map((p) => p.value), color: "#10b981", icon: <Icons.Volume size={13} />, ready: !feedQ.loading },
    { label: "Circulating Supply", value: circulating > 0 ? compact(circulating) : "—", change: undefined, series: [], color: "#f59e0b", icon: <Icons.Tokens size={13} />, ready: !supplyQ.loading },
    { label: "Total Supply", value: supply > 0 ? compact(supply) : "—", change: undefined, series: [], color: "#64748b", icon: <Icons.Tokens size={13} />, ready: !supplyQ.loading },
  ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <Link to={paths.tokens} className="hover:text-arc-600">Tokens</Link>
        <span>/</span>
        {identityReady ? (
          <span className="text-ink-700">{name} ({symbol})</span>
        ) : (
          <Skel className="h-3 w-32" />
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {tokenAddress ? (
            <TokenIcon address={tokenAddress} src={iconUrl} symbol={symbol ?? ""} size={56} />
          ) : (
            <Skel className="h-14 w-14 shrink-0 rounded-full" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {identityReady ? (
                <>
                  <h1 className="text-xl font-semibold text-ink-900">{name}</h1>
                  <span className="text-[14px] font-medium text-ink-400">{symbol}</span>
                  <Icons.Verified size={18} className="text-sky-500" />
                  <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium ${pill}`}>{category}</span>
                </>
              ) : (
                <>
                  <Skel className="h-6 w-32" />
                  <Skel className="h-4 w-10" />
                  <Skel className="h-5 w-16 rounded-md" />
                </>
              )}
            </div>

            {identityReady ? (
              <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-ink-500">
                {feed?.blurb ??
                  `${name} is a ${category.toLowerCase()} token on ${chain.name}${feed && feed.protocol !== "—" ? `, associated with ${feed.protocol}` : ""}.`}
              </p>
            ) : (
              <div className="mt-2 space-y-1.5">
                <Skel className="h-3 w-72" />
                <Skel className="h-3 w-52" />
              </div>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {tokenAddress ? (
                <>
                  <span className="font-mono text-[11px] text-ink-500">{shortHash(tokenAddress, 10, 8)}</span>
                  <button type="button" onClick={copyAddr} className="rounded-md border border-ink-200 bg-white px-2 py-0.5 text-[10px] font-medium text-ink-500 hover:border-arc-400 hover:text-arc-700">
                    {copied ? "Copied" : "Copy"}
                  </button>
                </>
              ) : (
                <Skel className="h-4 w-28" />
              )}
              <a href={scan} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-arc-600"><Icons.X size={14} /></a>
              <a href={scan} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-arc-600"><Icons.Globe size={14} /></a>
              <a href={scan} target="_blank" rel="noreferrer" className="text-ink-400 hover:text-arc-600"><Icons.Discord size={14} /></a>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={toggleWatch} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400">
            {watched ? <Icons.StarFilled size={14} className="text-amber-500" /> : <Icons.Star size={14} />}
            {watched ? "Watchlisted" : "Add to Watchlist"}
          </button>
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400">
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
            loading={!k.ready}
            hasSpark
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

      {tab === "Overview" && (
        <div className="grid gap-3 xl:grid-cols-5">
          <div className="space-y-3 xl:col-span-3">
            {chartsLoading ? (
              <div className="card flex min-h-[360px] flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-end border-b border-ink-100 px-3 py-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 7 }, (_, i) => <Skel key={i} className="h-5 w-8 rounded" />)}
                  </div>
                </div>
                <div className="flex flex-1 px-1 pb-2 pt-2">
                  <div className="flex w-12 shrink-0 flex-col justify-between py-2">
                    <Skel className="h-2 w-full" />
                    <Skel className="ml-auto h-2 w-3/4" />
                    <Skel className="ml-auto h-2 w-1/2" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div
                      className="skel h-full w-full rounded"
                      style={{ clipPath: "polygon(0% 62%,8% 47%,17% 55%,25% 35%,33% 44%,42% 25%,50% 38%,58% 20%,67% 33%,75% 16%,83% 29%,92% 22%,100% 36%,100% 100%,0% 100%)" }}
                    />
                  </div>
                </div>
              </div>
            ) : chartsReady ? (
              <TokenPriceChart data={charts.priceSeries} />
            ) : (
              <div className="card flex min-h-[360px] flex-col items-center justify-center text-sm text-ink-400">No data</div>
            )}

            {chartsLoading ? (
              <div className="card p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="panel-title">Market Cap &amp; Volume</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 6 }, (_, i) => <Skel key={i} className="h-5 w-8 rounded" />)}
                  </div>
                </div>
                <div className="flex h-[180px] items-end gap-px">
                  {[42, 58, 36, 72, 51, 84, 47, 63, 76, 40, 88, 54, 69, 45, 81, 57, 34, 74, 49, 86, 43, 66, 78, 52].map((h, i) => (
                    <div key={i} className="skel min-w-0 flex-1 rounded-t-[2px]" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            ) : charts.mcapSeries.length || charts.volSeries.length ? (
              <TokenMcapVolumeChart mcap={charts.mcapSeries} volume={charts.volSeries} />
            ) : (
              <div className="card p-3">
                <div className="mb-1 panel-title">Market Cap &amp; Volume</div>
                <div className="flex h-[180px] items-center justify-center text-sm text-ink-400">No data</div>
              </div>
            )}

            <TableCard title="Recent Transfers" viewAll={tokenAddress ? scan : undefined}>
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
                  {!transfersQ.data ? (
                    Array.from({ length: 6 }, (_, i) => (
                      <tr key={i}>
                        <td className={td}><Skel className="h-3.5 w-20" /></td>
                        <td className={td}><Skel className="h-3.5 w-16" /></td>
                        <td className={td}><Skel className="h-3.5 w-16" /></td>
                        <td className={td}><Skel className="ml-auto h-3.5 w-20" /></td>
                        <td className={td}><Skel className="ml-auto h-3.5 w-14" /></td>
                      </tr>
                    ))
                  ) : transfersQ.data.length ? (
                    transfersQ.data.slice(0, 8).map((tx, i) => {
                      const hash = String(tx.transaction_hash ?? tx.tx_hash ?? "");
                      const from = String((tx.from as { hash?: string } | undefined)?.hash ?? "");
                      const to = String((tx.to as { hash?: string } | undefined)?.hash ?? "");
                      const total = tx.total as { value?: string | number; decimals?: string } | undefined;
                      const dec = Number(total?.decimals ?? supplyInfo?.decimals ?? 18);
                      const amt = Number(total?.value ?? tx.value ?? 0) / 10 ** dec;
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
                            {Number.isFinite(amt) ? `${compact(amt)} ${symbol ?? ""}` : "—"}
                          </td>
                          <td className={`${td} text-right text-ink-500`}>{ts ? ago(ts) : "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={5} className="px-3 py-8 text-center text-ink-400">No transfers indexed.</td></tr>
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
                  <Row k="Token Name"><Val ready={identityReady} w="w-20">{name}</Val></Row>
                  <Row k="Symbol"><Val ready={identityReady} w="w-12">{symbol}</Val></Row>
                  <Row k="Decimals"><Val ready={!!supplyInfo} w="w-8">{supplyInfo?.decimals}</Val></Row>
                  <Row k="Token Type"><Val ready={!!feed} w="w-14">{category}</Val></Row>
                  <Row k="Protocol"><Val ready={!!feed} w="w-16">{feed?.protocol}</Val></Row>
                  <Row k="AMM">
                    <Val ready={!!feed} w="w-16">
                      {feed ? AMM_LABEL[feed.amm as keyof typeof AMM_LABEL] ?? feed.amm : null}
                    </Val>
                  </Row>
                  <Row k="Blockchain"><span className="text-right font-medium text-ink-800">{chain.name}</span></Row>
                  <Row k="Standard"><span className="text-right font-medium text-ink-800">ERC-20</span></Row>
                  <div className="flex justify-between gap-2 py-1.5 text-[11px]">
                    <span className="text-ink-400">Contract</span>
                    {tokenAddress ? (
                      <a href={scan} target="_blank" rel="noreferrer" className="font-mono text-arc-700 hover:underline">
                        {shortHash(tokenAddress, 6, 4)}
                      </a>
                    ) : (
                      <Skel className="h-3 w-20" />
                    )}
                  </div>
                </div>
                <div className="space-y-0">
                  <Row k="Market Cap Rank">
                    <Val ready={!!feed} w="w-10">{feed?.rank ? `#${feed.rank}` : "—"}</Val>
                  </Row>
                  <Row k="24h High">
                    <Val ready={!feedQ.loading} w="w-14">
                      {price != null && change24h != null ? usd(price * (1 + Math.max(0, change24h) / 100)) : "—"}
                    </Val>
                  </Row>
                  <Row k="24h Low">
                    <Val ready={!feedQ.loading} w="w-14">
                      {price != null && change24h != null ? usd(price * (1 + Math.min(0, change24h) / 100)) : "—"}
                    </Val>
                  </Row>
                  <Row k="All Time High">
                    <Val ready={chartsReady} w="w-14">{prices.length ? usd(Math.max(...prices)) : "—"}</Val>
                  </Row>
                  <Row k="All Time Low">
                    <Val ready={chartsReady} w="w-14">{prices.length ? usd(Math.min(...prices)) : "—"}</Val>
                  </Row>
                  <Row k="Holders">
                    <Val ready={holdersCount != null} w="w-12">{holdersCount != null ? compact(holdersCount) : "—"}</Val>
                  </Row>
                  <Row k="24h Transfers">
                    <Val ready={transfersCount != null} w="w-12">{transfersCount != null ? compact(transfersCount) : "—"}</Val>
                  </Row>
                </div>
              </div>
            </PanelCard>

            {holdersQ.loading || supplyQ.loading ? (
              <div className="card p-3">
                <div className="panel-title mb-2">Token Distribution</div>
                <div className="flex items-center gap-4">
                  <Skel className="h-[120px] w-[120px] shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    {Array.from({ length: 2 }, (_, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Skel className="h-2.5 w-2.5 rounded-full" />
                          <Skel className="h-3 w-20" />
                        </div>
                        <Skel className="h-3 w-8" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <TokenDistributionChart
                slices={holderSlices}
                center={supply > 0 ? compact(supply) : "—"}
              />
            )}

            <TableCard title="Top Holders" viewAll={tokenAddress ? scan : undefined}>
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
                  {!holdersQ.data ? (
                    Array.from({ length: 5 }, (_, i) => (
                      <tr key={i}>
                        <td className={`${td} text-ink-400`}>{i + 1}</td>
                        <td className={td}><Skel className="h-3.5 w-24" /></td>
                        <td className={td}><Skel className="ml-auto h-3.5 w-16" /></td>
                        <td className={td}><Skel className="ml-auto h-3.5 w-10" /></td>
                      </tr>
                    ))
                  ) : holdersQ.data.length ? (
                    holdersQ.data.slice(0, 6).map((h, i) => {
                      const addr = String((h.address as { hash?: string } | undefined)?.hash ?? h.address_hash ?? "");
                      const raw = Number(h.value ?? 0);
                      const dec = supplyInfo?.decimals ?? 18;
                      const scaled = raw / 10 ** dec;
                      // If scaling to zero (e.g. NFTs store raw count, not 1e18), use raw value
                      const bal = scaled > 0 ? scaled : raw;
                      const share = supply > 0 && bal > 0 ? (bal / supply) * 100 : 0;
                      return (
                        <tr key={`${addr}-${i}`}>
                          <td className={`${td} text-ink-400`}>{i + 1}</td>
                          <td className={td}>
                            <a href={explorerUrl(`/address/${addr}`)} target="_blank" rel="noreferrer" className="font-mono text-arc-700 hover:underline">
                              {shortHash(addr, 8, 6)}
                            </a>
                          </td>
                          <td className={`${td} text-right font-medium text-ink-800`}>
                            {supplyInfo ? compact(bal) : <Skel className="ml-auto h-3.5 w-16" />}
                          </td>
                          <td className={`${td} text-right text-ink-500`}>{share > 0 ? `${share.toFixed(2)}%` : "—"}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr><td colSpan={4} className="px-3 py-8 text-center text-ink-400">No holders indexed.</td></tr>
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
                  {feedQ.loading ? (
                    Array.from({ length: 2 }, (_, i) => (
                      <tr key={i}>
                        <td className={`${td} text-ink-400`}>{i + 1}</td>
                        <td className={td}>
                          <div className="flex items-center gap-1.5">
                            <Skel className="h-5 w-5 rounded" />
                            <Skel className="h-5 w-5 rounded" />
                            <Skel className="h-3.5 w-16" />
                          </div>
                        </td>
                        <td className={td}><Skel className="ml-auto h-3.5 w-12" /></td>
                        <td className={td}><Skel className="ml-auto h-3.5 w-14" /></td>
                        <td className={td}><Skel className="ml-auto h-3.5 w-10" /></td>
                        <td className={td}><Skel className="ml-auto h-3.5 w-14" /></td>
                      </tr>
                    ))
                  ) : markets.length ? (
                    markets.map((m, i) => (
                      <tr key={m.pair}>
                        <td className={`${td} text-ink-400`}>{i + 1}</td>
                        <td className={td}>
                          <span className="inline-flex items-center gap-1.5 font-medium text-ink-800">
                            {tokenAddress && <TokenIcon address={tokenAddress} src={iconUrl} symbol={symbol ?? ""} size={18} />}
                            <TokenIcon address={addresses.usdc} symbol="USDC" size={18} />
                            <span className="ml-0.5">{m.pair}</span>
                          </span>
                        </td>
                        <td className={`${td} text-right`}>{m.price != null ? usd(m.price) : "—"}</td>
                        <td className={`${td} text-right`}>{volume24h != null ? usd(volume24h) : "—"}</td>
                        <td className={`${td} text-right`}>
                          {m.change24h != null ? (
                            <span className={m.change24h >= 0 ? "text-emerald-600" : "text-rose-600"}>{pct(m.change24h)}</span>
                          ) : "—"}
                        </td>
                        <td className={`${td} text-right`}>{m.liquidity != null && m.liquidity > 0 ? usd(m.liquidity) : "—"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan={6} className="px-3 py-8 text-center text-ink-400">No markets indexed.</td></tr>
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

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-2 border-b border-ink-100 py-1.5 text-[11px]">
      <span className="text-ink-400">{k}</span>
      {children}
    </div>
  );
}
