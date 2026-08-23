import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DonutChart } from "@/components/charts/Charts";
import { Icons } from "@/components/shared/Icons";
import { Skel } from "@/components/shared/Skel";
import { PageNav } from "@/components/shared/PageNav";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { explorerUrl } from "@/config/network";
import { useAsyncData } from "@/hooks/useAsyncData";
import {
  loadAddressBalanceSeries,
  loadAddressNftList,
  loadAddressProfile,
  loadAddressTokenList,
  loadAddressTransferList,
  loadAddressTxList,
  mergeHoldings,
  portfolioSlices,
  type AddressTx,
} from "@/libs/addressDetail";
import { isWatched, subscribeWatch, toggleWatch as toggleWatchItem } from "@/libs/watchlist";
import { paths } from "@/routes/paths";
import { ago, compact, shortHash, usd, usdc } from "@/utils/format";

const TABS = [
  "Transactions",
  "Token Transfers",
  "ERC-721 / NFTs",
  "Tokens",
] as const;
type Tab = (typeof TABS)[number];
const DONUT = ["#7c3aed", "#3b82f6", "#f97316", "#10b981", "#94a3b8"];
const TX_PAGE = 10;
const TOKEN_PAGE = 10;

function walletHue(addr: string) {
  const n = parseInt(addr.slice(2, 8), 16) || 260;
  return `hsl(${n % 360} 62% 48%)`;
}

function methodTone(method: string) {
  const m = method.toLowerCase();
  if (m.includes("receive") || m === "in") return "bg-emerald-50 text-emerald-700";
  if (m.includes("transfer") || m.includes("send")) return "bg-sky-50 text-sky-700";
  if (m.includes("swap")) return "bg-violet-50 text-violet-700";
  if (m.includes("bridge")) return "bg-indigo-50 text-indigo-700";
  if (m.includes("approve")) return "bg-amber-50 text-amber-700";
  return "bg-ink-100 text-ink-600";
}

function AddrLink({ addr, self }: { addr: string; self: string }) {
  if (!addr) return <span className="text-ink-300">—</span>;
  const isSelf = addr === self;
  return (
    <Link
      to={paths.address(addr)}
      className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-600 hover:text-arc-700"
    >
      <span
        className="grid h-4 w-4 place-items-center rounded-full text-[8px] font-semibold text-white"
        style={{ background: walletHue(addr) }}
      >
        {addr.slice(2, 3).toUpperCase()}
      </span>
      {isSelf ? "Self" : shortHash(addr, 4, 4)}
    </Link>
  );
}

function NetSpark({ series }: { series: number[] }) {
  if (series.length < 2) {
    return <div className="mt-2 h-[52px] rounded bg-ink-50" />;
  }
  const max = Math.max(...series);
  const min = Math.min(...series);
  const span = max - min || 1;
  const w = 220;
  const h = 52;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * w;
    const y = h - 4 - ((v - min) / span) * (h - 10);
    return `${x},${y}`;
  });
  const line = pts.join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg className="mt-2 w-full" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="nw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#nw)" />
      <polyline points={line} fill="none" stroke="#8b5cf6" strokeWidth="2" />
    </svg>
  );
}

function TxTable({ rows, self }: { rows: AddressTx[]; self: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[780px] text-left text-[11px]">
        <thead>
          <tr className="border-b border-ink-200 text-[10px] uppercase tracking-wide text-ink-400">
            <th className="px-2.5 py-2 font-medium">Txn Hash</th>
            <th className="px-2.5 py-2 font-medium">Type</th>
            <th className="px-2.5 py-2 font-medium">Age</th>
            <th className="px-2.5 py-2 font-medium">From</th>
            <th className="px-2.5 py-2 font-medium">To</th>
            <th className="px-2.5 py-2 text-right font-medium">Value</th>
            <th className="px-2.5 py-2 font-medium">Token</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((tx) => {
            const typeLabel =
              tx.direction === "in" && tx.method === "transfer"
                ? "Receive"
                : tx.method || "Transfer";
            const signed =
              tx.valueUsdc > 0
                ? `${tx.direction === "in" ? "+" : tx.direction === "out" ? "-" : ""}${tx.valueUsdc >= 1000 ? compact(tx.valueUsdc) : tx.valueUsdc.toFixed(tx.valueUsdc >= 1 ? 2 : 4)}`
                : "—";
            return (
              <tr key={tx.hash + tx.method} className="border-b border-ink-100 hover:bg-ink-50">
                <td className="px-2.5 py-1.5">
                  <a
                    href={explorerUrl(`/tx/${tx.hash}`)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-arc-600 hover:underline"
                  >
                    {shortHash(tx.hash, 8, 6)}
                  </a>
                </td>
                <td className="px-2.5 py-1.5">
                  <span
                    className={`inline-flex max-w-[110px] truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${methodTone(typeLabel)}`}
                  >
                    {typeLabel}
                  </span>
                </td>
                <td className="px-2.5 py-1.5 whitespace-nowrap text-ink-400">
                  {tx.timestamp ? ago(tx.timestamp) : "—"}
                </td>
                <td className="px-2.5 py-1.5">
                  <AddrLink addr={tx.from} self={self} />
                </td>
                <td className="px-2.5 py-1.5">
                  <AddrLink addr={tx.to} self={self} />
                </td>
                <td
                  className={`px-2.5 py-1.5 text-right font-medium ${
                    tx.direction === "in" && tx.valueUsdc > 0
                      ? "text-emerald-600"
                      : "text-ink-800"
                  }`}
                >
                  {signed}
                </td>
                <td className="px-2.5 py-1.5 text-ink-500">{tx.tokenSymbol}</td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={7} className="px-3 py-10 text-center text-ink-400">
                No activity found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TxRowSkel() {
  return (
    <tr className="border-b border-ink-100">
      {Array.from({ length: 7 }, (_, i) => (
        <td key={i} className="px-2.5 py-1.5">
          <Skel className={`h-3 ${i === 5 ? "ml-auto w-12" : "w-16"}`} />
        </td>
      ))}
    </tr>
  );
}

function TokenRowSkel({ cols = 4 }: { cols?: number }) {
  return (
    <tr className="border-b border-ink-100">
      {Array.from({ length: cols }, (_, i) => (
        <td key={i} className="px-2.5 py-1.5">
          <Skel className={`h-3 ${i === 0 ? "w-24" : "ml-auto w-12"}`} />
        </td>
      ))}
    </tr>
  );
}

function StatCellSkel() {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <Skel className="h-2.5 w-14" />
      <Skel className="mt-1.5 h-3.5 w-16" />
      <Skel className="mt-1 h-2.5 w-12" />
    </div>
  );
}

function SideBlockSkel({ title, rows = 5 }: { title: string; rows?: number }) {
  return (
    <div className="card p-3">
      <div className="mb-2 text-[11px] font-semibold text-ink-700">{title}</div>
      <div className="space-y-2">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Skel className="h-5 w-5 rounded-full" />
              <Skel className="h-3 w-14" />
            </div>
            <div className="space-y-1">
              <Skel className="ml-auto h-3 w-12" />
              <Skel className="ml-auto h-2.5 w-10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
export function AddressDetailPage() {
  const { address = "" } = useParams();
  const key = address.toLowerCase();
  const profileQ = useAsyncData(`addr-profile:${key}`, () => loadAddressProfile(address), [address]);
  const tokensQ = useAsyncData(`addr-tokens:${key}`, () => loadAddressTokenList(address), [address]);
  const nftsQ = useAsyncData(`addr-nfts:${key}`, () => loadAddressNftList(address), [address]);
  const txsQ = useAsyncData(`addr-txs:${key}`, () => loadAddressTxList(address), [address]);
  const transfersQ = useAsyncData(`addr-xfers:${key}`, () => loadAddressTransferList(address), [address]);
  const seriesQ = useAsyncData(`addr-series:${key}`, () => loadAddressBalanceSeries(address), [address]);

  const profile = profileQ.data;
  const tokens = tokensQ.data ?? [];
  const nfts = nftsQ.data ?? [];
  const txs = txsQ.data ?? [];
  const transfers = transfersQ.data ?? [];
  const balanceSeries = seriesQ.data ?? [];

  const profileBoot = profileQ.loading && !profile;
  const tokensBoot = tokensQ.loading && !tokensQ.data;
  const nftsBoot = nftsQ.loading && !nftsQ.data;
  const txsBoot = txsQ.loading && !txsQ.data;
  const transfersBoot = transfersQ.loading && !transfersQ.data;
  const seriesBoot = seriesQ.loading && !seriesQ.data;

  const holdings = useMemo(
    () => mergeHoldings(profile?.nativeUsdc ?? 0, tokens),
    [profile?.nativeUsdc, tokens],
  );
  const tokenValueUsd = useMemo(() => holdings.reduce((s, t) => s + t.valueUsd, 0), [holdings]);
  const netWorth = tokenValueUsd;
  const portfolio = useMemo(
    () => (profile ? portfolioSlices(profile.nativeUsdc, tokens, nfts) : []),
    [profile, tokens, nfts],
  );
  const lastActive = txs[0]?.timestamp ?? null;
  const firstSeen = balanceSeries[0]?.date ? `${balanceSeries[0].date}T00:00:00.000Z` : null;
  const error = profileQ.error;
  const [tab, setTab] = useState<Tab>("Transactions");
  const [txPage, setTxPage] = useState(1);
  const [tokenPage, setTokenPage] = useState(1);
  const [copied, setCopied] = useState(false);
  const [watched, setWatched] = useState(() => isWatched("wallet", address));

  useEffect(() => {
    setTab("Transactions");
    setTxPage(1);
    setTokenPage(1);
    setWatched(isWatched("wallet", address));
    return subscribeWatch(() => setWatched(isWatched("wallet", address)));
  }, [address]);

  const spark = useMemo(
    () => balanceSeries.map((d) => d.value),
    [balanceSeries],
  );
  const change24h = useMemo(() => {
    if (spark.length < 2) return null;
    const prev = spark[spark.length - 2];
    const cur = spark[spark.length - 1];
    if (!(prev > 0)) return null;
    return { delta: cur - prev, pct: ((cur - prev) / prev) * 100 };
  }, [spark]);

  if (!profileBoot && (error || !profile)) {
    return <div className="card p-5 text-sm text-ink-500">{error ?? "Address not found."}</div>;
  }

  const addr = profile?.address ?? key;
  const scan = explorerUrl(`/address/${addr}`);
  const display = shortHash(addr, 6, 4);
  const title = profile?.name || profile?.ens || display;

  const toggleWatch = () => {
    if (profile) void toggleWatchItem("wallet", profile.address);
  };

  const copyAddr = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const listBoot =
    tab === "Token Transfers" ? transfersBoot : tab === "Tokens" ? tokensBoot : tab === "ERC-721 / NFTs" ? nftsBoot : txsBoot;
  const allRows = tab === "Token Transfers" ? transfers : txs;
  const txPages = Math.max(1, Math.ceil(allRows.length / TX_PAGE));
  const page = Math.min(txPage, txPages);
  const rows = allRows.slice((page - 1) * TX_PAGE, page * TX_PAGE);

  const tokenPages = Math.max(1, Math.ceil(holdings.length / TOKEN_PAGE));
  const tPage = Math.min(tokenPage, tokenPages);
  const tokenRows = holdings.slice((tPage - 1) * TOKEN_PAGE, tPage * TOKEN_PAGE);

  return (
    <div className="space-y-2">
      {/* breadcrumb */}
      <div className="flex min-w-0 items-center gap-1 text-[11px] text-ink-400">
        <Link to={paths.home} className="shrink-0 hover:text-arc-700">
          Home
        </Link>
        <span className="shrink-0">›</span>
        <span className="shrink-0">Address</span>
        <span className="shrink-0">›</span>
        {profileBoot ? <Skel className="h-3 w-28" /> : <span className="truncate font-mono text-ink-600">{display}</span>}
      </div>

      {/* profile header */}
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-bold text-white shadow-sm"
            style={{ background: walletHue(addr) }}
          >
            {addr.slice(2, 4).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              {profileBoot ? (
                <Skel className="h-5 w-40" />
              ) : (
                <h1 className="min-w-0 truncate font-mono text-[18px] font-semibold tracking-tight text-ink-900">
                  {title}
                </h1>
              )}
              <button
                type="button"
                onClick={copyAddr}
                className="shrink-0 rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                title="Copy address"
              >
                {copied ? (
                  <span className="text-[10px] text-emerald-600">✓</span>
                ) : (
                  <Icons.Contracts size={13} />
                )}
              </button>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                  profile?.isContract
                    ? "bg-violet-100 text-violet-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {profile?.isContract ? "Contract" : "EOA"}
              </span>
              {lastActive && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              )}
              {firstSeen && (
                <span className="text-[10px] text-ink-400">
                  First seen: {ago(firstSeen)}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleWatch}
          className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:border-violet-300 dark:border-[var(--line)] dark:bg-[var(--surface-1)] dark:text-ink-300"
        >
          {watched ? (
            <Icons.StarFilled size={13} className="text-amber-500" />
          ) : (
            <Icons.Star size={13} />
          )}
          {watched ? "Watchlisted" : "Add to Watchlist"}
        </button>
      </div>

      {/* overview strip — single card row like mock */}
      <div className="card grid grid-cols-2 divide-x divide-y divide-ink-100 overflow-hidden sm:grid-cols-3 xl:grid-cols-6">
        {profileBoot || tokensBoot
          ? Array.from({ length: 6 }, (_, i) => <StatCellSkel key={i} />)
          : [
          {
            label: "USDC Balance",
            value: usdc((profile?.nativeUsdc ?? 0)),
            sub: usd((profile?.nativeUsdc ?? 0)),
          },
          {
            label: "Token Value",
            value: usd(tokenValueUsd),
            sub: `${holdings.length} tokens`,
          },
          {
            label: "Tokens Held",
            value: compact(holdings.length),
            sub: "View Tokens",
            onClick: () => setTab("Tokens"),
          },
          {
            label: "Transactions",
            value: compact((profile?.txCount ?? 0)),
            sub: "View Transactions",
            onClick: () => setTab("Transactions"),
          },
          {
            label: "First Seen",
            value: firstSeen ? ago(firstSeen) : "—",
            sub: firstSeen ? firstSeen.slice(0, 10) : "",
          },
          {
            label: "Last Tx",
            value: lastActive ? ago(lastActive) : "—",
            sub: "View Latest Tx",
            onClick: () => setTab("Transactions"),
          },
        ].map((cell) => (
          <div key={cell.label} className="min-w-0 px-3 py-2.5">
            <div className="truncate text-[10px] font-medium text-ink-400">{cell.label}</div>
            <div className="mt-0.5 truncate text-[14px] font-semibold text-ink-900">{cell.value}</div>
            {cell.onClick ? (
              <button
                type="button"
                onClick={cell.onClick}
                className="mt-0.5 block max-w-full text-left text-[10px] font-medium text-arc-600 hover:underline"
              >
                {cell.sub}
              </button>
            ) : (
              <div className="mt-0.5 truncate text-[10px] text-ink-400">{cell.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* main + sidebar */}
      <div className="grid min-w-0 items-start gap-3 lg:grid-cols-[minmax(0,1fr)_378px]">
        <div className="min-w-0 space-y-2">
          <div className="card min-w-0 overflow-hidden">
            {/* underlined tabs */}
            <div className="no-scrollbar flex gap-0 overflow-x-auto border-b border-ink-200 px-2">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setTxPage(1);
                    setTokenPage(1);
                  }}
                  className={`shrink-0 border-b-2 px-3 py-2 text-[12px] font-medium transition ${
                    tab === t
                      ? "border-violet-600 text-violet-700"
                      : "border-transparent text-ink-400 hover:text-ink-700"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {(tab === "Transactions" || tab === "Token Transfers") && (
              <>
                {listBoot ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-[11px]">
                      <thead>
                        <tr className="border-b border-ink-200 text-[10px] uppercase tracking-wide text-ink-400">
                          <th className="px-2.5 py-2 font-medium">Txn Hash</th>
                          <th className="px-2.5 py-2 font-medium">Type</th>
                          <th className="px-2.5 py-2 font-medium">Age</th>
                          <th className="px-2.5 py-2 font-medium">From</th>
                          <th className="px-2.5 py-2 font-medium">To</th>
                          <th className="px-2.5 py-2 text-right font-medium">Value</th>
                          <th className="px-2.5 py-2 font-medium">Token</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from({ length: TX_PAGE }, (_, i) => (
                          <TxRowSkel key={i} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <TxTable rows={rows} self={addr} />
                )}
                <div className="border-t border-ink-100 px-2 py-1.5">
                  <PageNav
                    page={page}
                    hasPrev={page > 1}
                    hasNext={page < txPages}
                    onPrev={() => setTxPage((p) => Math.max(1, p - 1))}
                    onNext={() => setTxPage((p) => Math.min(txPages, p + 1))}
                    pageSize={rows.length}
                  />
                </div>
              </>
            )}

            {tab === "Tokens" && (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[11px]">
                    <thead>
                      <tr className="border-b border-ink-200 text-[10px] uppercase text-ink-400">
                        <th className="px-2.5 py-2 font-medium">Token</th>
                        <th className="px-2.5 py-2 text-right font-medium">Balance</th>
                        <th className="px-2.5 py-2 text-right font-medium">Value</th>
                        <th className="px-2.5 py-2 text-right font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tokensBoot
                        ? Array.from({ length: TOKEN_PAGE }, (_, i) => <TokenRowSkel key={i} />)
                        : tokenRows.map((t) => (
                        <tr key={t.address} className="border-b border-ink-100 hover:bg-ink-50">
                          <td className="px-2.5 py-1.5">
                            <Link
                              to={paths.token(t.address)}
                              className="inline-flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                            >
                              <TokenIcon
                                address={t.address}
                                src={t.iconUrl}
                                symbol={t.symbol}
                                size={18}
                              />
                              {t.name || t.symbol}
                            </Link>
                          </td>
                          <td className="px-2.5 py-1.5 text-right">
                            {t.type === "native" ? usdc(t.balance) : compact(t.balance)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-medium">
                            {t.valueUsd > 0 ? usd(t.valueUsd) : "—"}
                          </td>
                          <td className="px-2.5 py-1.5 text-right text-ink-500">
                            {t.price != null ? usd(t.price) : "—"}
                          </td>
                        </tr>
                      ))}
                      {!tokensBoot && !tokenRows.length && (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-ink-400">
                            No tokens
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-ink-100 px-2 py-1.5">
                  <PageNav
                    page={tPage}
                    hasPrev={tPage > 1}
                    hasNext={tPage < tokenPages}
                    onPrev={() => setTokenPage((p) => Math.max(1, p - 1))}
                    onNext={() => setTokenPage((p) => Math.min(tokenPages, p + 1))}
                    pageSize={tokenRows.length}
                  />
                </div>
              </>
            )}

            {tab === "ERC-721 / NFTs" && (
              <div className="divide-y divide-ink-100">
                {nftsBoot
                  ? Array.from({ length: 5 }, (_, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                        <Skel className="h-7 w-7 rounded" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Skel className="h-3 w-32" />
                          <Skel className="h-2.5 w-16" />
                        </div>
                        <Skel className="h-3 w-8" />
                      </div>
                    ))
                  : nfts.map((n) => (
                  <Link
                    key={n.address}
                    to={paths.token(n.address)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50"
                  >
                    <TokenIcon
                      address={n.address}
                      src={n.iconUrl}
                      symbol={n.symbol}
                      size={28}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-ink-800">
                        {n.name || n.symbol || shortHash(n.address)}
                      </div>
                      <div className="text-[10px] text-ink-400">{n.symbol}</div>
                    </div>
                    <span className="text-[11px] font-medium text-ink-600">×{n.count}</span>
                  </Link>
                ))}
                {!nftsBoot && !nfts.length && (
                  <div className="py-10 text-center text-[12px] text-ink-400">No NFTs</div>
                )}
              </div>
            )}
          </div>

          {/* bottom holdings — mock layout */}
          <div className="grid min-w-0 gap-2 md:grid-cols-2">
            <div className="card min-w-0 overflow-hidden">
              <div className="border-b border-ink-100 px-3 py-2">
                <span className="text-[12px] font-semibold text-ink-800">Token Holdings</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                      <th className="px-2.5 py-1.5 font-medium">Token</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Balance</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Value</th>
                      <th className="px-2.5 py-1.5 font-medium">% Port.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokensBoot
                      ? Array.from({ length: 5 }, (_, i) => <TokenRowSkel key={i} cols={4} />)
                      : tokenRows.map((t) => {
                      const pct =
                        netWorth > 0
                          ? Math.min(100, (t.valueUsd / netWorth) * 100)
                          : 0;
                      return (
                        <tr key={t.address} className="border-b border-ink-50">
                          <td className="px-2.5 py-1.5">
                            <Link
                              to={paths.token(t.address)}
                              className="inline-flex items-center gap-1.5 font-medium text-ink-800"
                            >
                              <TokenIcon
                                address={t.address}
                                src={t.iconUrl}
                                symbol={t.symbol}
                                size={16}
                              />
                              {t.symbol || shortHash(t.address)}
                            </Link>
                          </td>
                          <td className="px-2.5 py-1.5 text-right text-ink-600">
                            {t.type === "native" ? usdc(t.balance) : compact(t.balance)}
                          </td>
                          <td className="px-2.5 py-1.5 text-right font-medium">
                            {t.valueUsd > 0 ? usd(t.valueUsd) : "—"}
                          </td>
                          <td className="px-2.5 py-1.5">
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-12 overflow-hidden rounded-full bg-ink-100">
                                <div
                                  className="h-full rounded-full bg-violet-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-ink-400">{pct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {!tokensBoot && !tokenRows.length && (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-ink-400">
                          No tokens
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-ink-100 px-2 py-1.5">
                <PageNav
                  page={tPage}
                  hasPrev={tPage > 1}
                  hasNext={tPage < tokenPages}
                  onPrev={() => setTokenPage((p) => Math.max(1, p - 1))}
                  onNext={() => setTokenPage((p) => Math.min(tokenPages, p + 1))}
                  pageSize={tokenRows.length}
                />
              </div>
            </div>

            <div className="card min-w-0 overflow-hidden">
              <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-3 py-2">
                <span className="truncate text-[12px] font-semibold text-ink-800">
                  NFT Holdings (Top {Math.min(4, nfts.length)})
                </span>
                <button
                  type="button"
                  onClick={() => setTab("ERC-721 / NFTs")}
                  className="shrink-0 text-[10px] font-medium text-arc-600"
                >
                  View all
                </button>
              </div>
              <div className="divide-y divide-ink-100">
                {nftsBoot
                  ? Array.from({ length: 4 }, (_, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                        <Skel className="h-9 w-9 rounded-md" />
                        <div className="min-w-0 flex-1 space-y-1">
                          <Skel className="h-3 w-28" />
                          <Skel className="h-2.5 w-14" />
                        </div>
                        <Skel className="h-3 w-8" />
                      </div>
                    ))
                  : nfts.slice(0, 4).map((n) => (
                  <Link
                    key={n.address}
                    to={paths.token(n.address)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50"
                  >
                    <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-ink-100">
                      <TokenIcon
                        address={n.address}
                        src={n.iconUrl}
                        symbol={n.symbol}
                        size={28}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-medium text-ink-800">
                        {n.name || n.symbol || shortHash(n.address)}
                      </div>
                      <div className="text-[10px] text-ink-400">{n.symbol}</div>
                    </div>
                    <span className="text-[11px] font-semibold text-ink-700">×{n.count}</span>
                  </Link>
                ))}
                {!nftsBoot && !nfts.length && (
                  <div className="py-8 text-center text-[12px] text-ink-400">No NFTs</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* right sidebar */}
        <aside className="min-w-0 space-y-3">
          {profileBoot || seriesBoot ? (
            <div className="card min-w-0 p-3">
              <div className="text-[11px] font-semibold text-ink-700">Address Summary</div>
              <Skel className="mt-2 h-5 w-28" />
              <Skel className="mt-2 h-3 w-36" />
              <Skel className="mt-3 h-[52px] w-full" />
            </div>
          ) : (
          <div className="card min-w-0 p-3">
            <div className="text-[11px] font-semibold text-ink-700">Address Summary</div>
            <div className="mt-1 truncate text-[20px] font-semibold tracking-tight text-ink-900">
              {usd(netWorth)}
            </div>
            {change24h ? (
              <div
                className={`text-[11px] font-medium ${
                  change24h.delta >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {change24h.delta >= 0 ? "+" : ""}
                {usd(change24h.delta)} ({change24h.pct >= 0 ? "+" : ""}
                {change24h.pct.toFixed(2)}%)
                <span className="font-normal text-ink-400"> 24h</span>
              </div>
            ) : (
              <div className="text-[11px] text-ink-400">Native balance trend</div>
            )}
            <NetSpark series={spark} />
          </div>
          )}

          {tokensBoot || profileBoot ? (
            <div className="card p-3">
              <div className="panel-title mb-2">Portfolio Distribution</div>
              <div className="flex items-center gap-3">
                <Skel className="h-24 w-24 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skel className="h-3 w-full" />
                  <Skel className="h-3 w-4/5" />
                  <Skel className="h-3 w-3/5" />
                </div>
              </div>
            </div>
          ) : (
            <DonutChart title="Portfolio Distribution" slices={portfolio} colors={DONUT} />
          )}

          {tokensBoot || profileBoot ? (
            <SideBlockSkel title="Token Balances (Top 5)" />
          ) : (
          <div className="card p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-semibold text-ink-700">
                Token Balances (Top 5)
              </span>
              <button
                type="button"
                onClick={() => setTab("Tokens")}
                className="text-[10px] font-medium text-arc-600"
              >
                View All
              </button>
            </div>
            <div className="space-y-2">
              {holdings.slice(0, 5).map((t) => (
                <div key={t.address} className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="flex min-w-0 items-center gap-1.5 text-ink-600">
                    <TokenIcon
                      address={t.address}
                      src={t.iconUrl}
                      symbol={t.symbol}
                      size={18}
                    />
                    <span className="truncate">{t.symbol || shortHash(t.address)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-medium text-ink-800">
                      {t.type === "native" ? usdc(t.balance) : compact(t.balance)}
                    </span>
                    <span className="text-[10px] text-ink-400">
                      {t.valueUsd > 0 ? usd(t.valueUsd) : "—"}
                    </span>
                  </span>
                </div>
              ))}
              {!holdings.length && (
                <div className="py-4 text-center text-[11px] text-ink-400">No tokens</div>
              )}
            </div>
          </div>
          )}

          {profileBoot ? (
            <SideBlockSkel title="More Info" rows={5} />
          ) : (
          <div className="card p-3 text-[11px]">
            <div className="mb-2 text-[11px] font-semibold text-ink-700">More Info</div>
            <dl className="space-y-1.5 text-ink-500">
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">Address Label</dt>
                <dd className="min-w-0 truncate font-medium text-ink-800">{profile?.name || profile?.ens || "—"}</dd>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">Type</dt>
                <dd className="min-w-0 truncate font-medium text-ink-800">
                  {profile?.isContract ? "Contract" : "EOA"}
                </dd>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">Txns Count</dt>
                <dd className="min-w-0 truncate font-medium text-ink-800">{compact((profile?.txCount ?? 0))}</dd>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">Token Transfers</dt>
                <dd className="min-w-0 truncate font-medium text-ink-800">
                  {compact((profile?.tokenTransferCount ?? 0))}
                </dd>
              </div>
              <div className="flex min-w-0 justify-between gap-2">
                <dt className="shrink-0">Last Active</dt>
                <dd className="min-w-0 truncate font-medium text-ink-800">
                  {lastActive ? ago(lastActive) : "—"}
                </dd>
              </div>
            </dl>
            <a
              href={scan}
              target="_blank"
              rel="noreferrer"
              className="mt-2.5 inline-flex text-[11px] font-medium text-violet-600 hover:underline"
            >
              View on ArcScan →
            </a>
          </div>
          )}
        </aside>
      </div>
    </div>
  );
}
