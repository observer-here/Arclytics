import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DonutChart } from "@/components/charts/Charts";
import { Icons } from "@/components/shared/Icons";
import { PageNav } from "@/components/shared/PageNav";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { explorerUrl } from "@/config/network";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadAddressDetail, type AddressTx } from "@/libs/addressDetail";
import { isWatched, toggleWatch as toggleWatchItem } from "@/libs/watchlist";
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
              <tr key={tx.hash + tx.method} className="border-b border-ink-100 hover:bg-ink-50/70">
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

export function AddressDetailPage() {
  const { address = "" } = useParams();
  const { data, loading, error } = useAsyncData(
    `address-detail-v2:${address.toLowerCase()}`,
    () => loadAddressDetail(address),
    [address],
  );
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
  }, [address]);

  const spark = useMemo(
    () => (data?.balanceSeries ?? []).map((d) => d.value),
    [data?.balanceSeries],
  );
  const change24h = useMemo(() => {
    if (spark.length < 2) return null;
    const prev = spark[spark.length - 2];
    const cur = spark[spark.length - 1];
    if (!(prev > 0)) return null;
    return { delta: cur - prev, pct: ((cur - prev) / prev) * 100 };
  }, [spark]);

  if (loading) return <div className="text-sm text-ink-400">Loading address…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;
  if (!data) return <div className="card p-5 text-sm text-ink-500">Address not found.</div>;

  const scan = explorerUrl(`/address/${data.address}`);
  const display = shortHash(data.address, 6, 4);
  const title = data.name || data.ens || display;

  const toggleWatch = () => {
    toggleWatchItem("wallet", data.address);
    setWatched(isWatched("wallet", data.address));
  };

  const copyAddr = async () => {
    try {
      await navigator.clipboard.writeText(data.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* ignore */
    }
  };

  const allRows = tab === "Token Transfers" ? data.transfers : data.txs;
  const txPages = Math.max(1, Math.ceil(allRows.length / TX_PAGE));
  const page = Math.min(txPage, txPages);
  const rows = allRows.slice((page - 1) * TX_PAGE, page * TX_PAGE);

  const tokensByValue = data.tokens;
  const tokenPages = Math.max(1, Math.ceil(tokensByValue.length / TOKEN_PAGE));
  const tPage = Math.min(tokenPage, tokenPages);
  const tokenRows = tokensByValue.slice((tPage - 1) * TOKEN_PAGE, tPage * TOKEN_PAGE);

  return (
    <div className="space-y-2">
      {/* breadcrumb */}
      <div className="flex items-center gap-1 text-[11px] text-ink-400">
        <Link to={paths.home} className="hover:text-arc-700">
          Home
        </Link>
        <span>›</span>
        <span>Address</span>
        <span>›</span>
        <span className="font-mono text-ink-600">{display}</span>
      </div>

      {/* profile header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-bold text-white shadow-sm"
            style={{ background: walletHue(data.address) }}
          >
            {data.address.slice(2, 4).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <h1 className="font-mono text-[18px] font-semibold tracking-tight text-ink-900">
                {title}
              </h1>
              <button
                type="button"
                onClick={copyAddr}
                className="rounded p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
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
                  data.isContract
                    ? "bg-violet-100 text-violet-700"
                    : "bg-emerald-100 text-emerald-700"
                }`}
              >
                {data.isContract ? "Contract" : "EOA"}
              </span>
              {data.lastActive && (
                <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              )}
              {data.firstSeen && (
                <span className="text-[10px] text-ink-400">
                  First seen: {ago(data.firstSeen)}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={toggleWatch}
          className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:border-violet-300"
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
      <div className="card grid grid-cols-2 divide-ink-100 sm:grid-cols-3 xl:grid-cols-6 xl:divide-x">
        {[
          {
            label: "USDC Balance",
            value: usdc(data.nativeUsdc),
            sub: usd(data.nativeUsdc),
          },
          {
            label: "Token Value",
            value: usd(data.tokenValueUsd),
            sub: `${data.tokenCount} tokens`,
          },
          {
            label: "Tokens Held",
            value: compact(data.tokenCount),
            sub: "View Tokens",
            onClick: () => setTab("Tokens"),
          },
          {
            label: "Transactions",
            value: compact(data.txCount),
            sub: "View Transactions",
            onClick: () => setTab("Transactions"),
          },
          {
            label: "First Seen",
            value: data.firstSeen ? ago(data.firstSeen) : "—",
            sub: data.firstSeen ? data.firstSeen.slice(0, 10) : "",
          },
          {
            label: "Last Tx",
            value: data.lastActive ? ago(data.lastActive) : "—",
            sub: "View Latest Tx",
            onClick: () => setTab("Transactions"),
          },
        ].map((cell) => (
          <div key={cell.label} className="px-3 py-2.5">
            <div className="text-[10px] font-medium text-ink-400">{cell.label}</div>
            <div className="mt-0.5 text-[14px] font-semibold text-ink-900">{cell.value}</div>
            {cell.onClick ? (
              <button
                type="button"
                onClick={cell.onClick}
                className="mt-0.5 text-[10px] font-medium text-arc-600 hover:underline"
              >
                {cell.sub}
              </button>
            ) : (
              <div className="mt-0.5 text-[10px] text-ink-400">{cell.sub}</div>
            )}
          </div>
        ))}
      </div>

      {/* main + sidebar */}
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_378px]">
        <div className="space-y-2">
          <div className="card overflow-hidden">
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
                <TxTable rows={rows} self={data.address} />
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
                      {tokenRows.map((t) => (
                        <tr key={t.address} className="border-b border-ink-100 hover:bg-ink-50/70">
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
                          <td className="px-2.5 py-1.5 text-right">{compact(t.balance)}</td>
                          <td className="px-2.5 py-1.5 text-right font-medium">
                            {t.valueUsd > 0 ? usd(t.valueUsd) : "—"}
                          </td>
                          <td className="px-2.5 py-1.5 text-right text-ink-500">
                            {t.price != null ? usd(t.price) : "—"}
                          </td>
                        </tr>
                      ))}
                      {!tokenRows.length && (
                        <tr>
                          <td colSpan={4} className="py-10 text-center text-ink-400">
                            No ERC-20 tokens
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
                {data.nfts.map((n) => (
                  <Link
                    key={n.address}
                    to={paths.token(n.address)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50/70"
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
                {!data.nfts.length && (
                  <div className="py-10 text-center text-[12px] text-ink-400">No NFTs</div>
                )}
              </div>
            )}
          </div>

          {/* bottom holdings — mock layout */}
          <div className="grid gap-2 md:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="border-b border-ink-100 px-3 py-2">
                <span className="text-[12px] font-semibold text-ink-800">Token Holdings</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                      <th className="px-2.5 py-1.5 font-medium">Token</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Balance</th>
                      <th className="px-2.5 py-1.5 text-right font-medium">Value</th>
                      <th className="px-2.5 py-1.5 font-medium">% Port.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenRows.map((t) => {
                      const pct =
                        data.netWorth > 0
                          ? Math.min(100, (t.valueUsd / data.netWorth) * 100)
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
                            {compact(t.balance)}
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
                    {!tokenRows.length && (
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

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
                <span className="text-[12px] font-semibold text-ink-800">
                  NFT Holdings (Top {Math.min(4, data.nfts.length)})
                </span>
                <button
                  type="button"
                  onClick={() => setTab("ERC-721 / NFTs")}
                  className="text-[10px] font-medium text-arc-600"
                >
                  View all
                </button>
              </div>
              <div className="divide-y divide-ink-50">
                {data.nfts.slice(0, 4).map((n) => (
                  <Link
                    key={n.address}
                    to={paths.token(n.address)}
                    className="flex items-center gap-2.5 px-3 py-2 hover:bg-ink-50/70"
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
                {!data.nfts.length && (
                  <div className="py-8 text-center text-[12px] text-ink-400">No NFTs</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* right sidebar */}
        <aside className="space-y-3">
          <div className="card p-3">
            <div className="text-[11px] font-semibold text-ink-700">Address Summary</div>
            <div className="mt-1 text-[20px] font-semibold tracking-tight text-ink-900">
              {usd(data.netWorth)}
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

          <DonutChart title="Portfolio Distribution" slices={data.portfolio} colors={DONUT} />

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
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="flex items-center gap-1.5 text-ink-600">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-sky-100 text-[9px] font-bold text-sky-700">
                    $
                  </span>
                  USDC
                </span>
                <span className="text-right">
                  <span className="block font-medium text-ink-800">{usdc(data.nativeUsdc)}</span>
                  <span className="text-[10px] text-ink-400">{usd(data.nativeUsdc)}</span>
                </span>
              </div>
              {data.tokens.slice(0, 4).map((t) => (
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
                    <span className="block font-medium text-ink-800">{compact(t.balance)}</span>
                    <span className="text-[10px] text-ink-400">
                      {t.valueUsd > 0 ? usd(t.valueUsd) : "—"}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-3 text-[11px]">
            <div className="mb-2 text-[11px] font-semibold text-ink-700">More Info</div>
            <dl className="space-y-1.5 text-ink-500">
              <div className="flex justify-between gap-2">
                <dt>Address Label</dt>
                <dd className="font-medium text-ink-800">{data.name || data.ens || "—"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Type</dt>
                <dd className="font-medium text-ink-800">
                  {data.isContract ? "Contract" : "EOA"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Txns Count</dt>
                <dd className="font-medium text-ink-800">{compact(data.txCount)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Token Transfers</dt>
                <dd className="font-medium text-ink-800">
                  {compact(data.tokenTransferCount)}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Last Active</dt>
                <dd className="font-medium text-ink-800">
                  {data.lastActive ? ago(data.lastActive) : "—"}
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
        </aside>
      </div>
    </div>
  );
}
