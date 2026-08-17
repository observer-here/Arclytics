import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AreaChartCard, BarChartCard, DonutChart, MultiLineChart } from "@/components/charts/Charts";
import { Icons } from "@/components/shared/Icons";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { CATEGORY_PILL } from "@/config/ecosystem";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadProtocolDetail } from "@/libs/protocolDetail";
import { isWatched, toggleWatch as toggleWatchItem } from "@/libs/watchlist";
import { paths } from "@/routes/paths";
import { ago, compact, shortHash, usd } from "@/utils/format";

const TABS = [
  "Overview",
  "Pools",
  "Transactions",
  "Users",
  "Contracts",
  "Agents",
  "Tokenomics",
  "Analytics",
  "About",
] as const;

type Tab = (typeof TABS)[number];

const ROLE_LABEL: Record<string, string> = {
  vault: "Vault",
  pool: "Pool",
  router: "Core",
  factory: "Factory",
  lending_pool: "Lending",
  gauge: "Gauge",
  token: "Token",
  bridge: "Bridge",
  other: "Core",
};

function Spark({ series, color }: { series: number[]; color: string }) {
  if (series.length < 2) return null;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || Math.max(Math.abs(max), 1) * 0.02 || 1;
  const line = series
    .map((v, i) => {
      const x = (i / Math.max(series.length - 1, 1)) * 100;
      const y = 16 - ((v - min) / range) * 12;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `0,20 ${line} 100,20`;
  const id = `ps-${color.replace("#", "")}`;
  return (
    <svg className="mt-1 w-full" height="20" viewBox="0 0 100 20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${id})`} />
      <polyline fill="none" stroke={color} strokeWidth="1.8" points={line} />
    </svg>
  );
}

function Kpi({
  label,
  value,
  change,
  series,
  color,
}: {
  label: string;
  value: string;
  change?: number;
  series: number[];
  color: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="card-pad">
      <div className="text-[10px] text-ink-500">{label}</div>
      <div className="mt-0.5 flex items-baseline justify-between gap-2">
        <div className="text-[15px] font-semibold text-ink-900">{value}</div>
        {change != null && (
          <span className={up ? "badge-up" : "badge-down"}>
            {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
          </span>
        )}
      </div>
      {series.length > 1 && <Spark series={series} color={color} />}
    </div>
  );
}

export function ProtocolDetailPage() {
  const { slug = "" } = useParams();
  const { data, loading, error } = useAsyncData(
    `protocol-detail-v6:${slug}`,
    () => loadProtocolDetail(slug),
    [slug],
  );
  const [tab, setTab] = useState<Tab>("Overview");
  const [watched, setWatched] = useState(() => isWatched("protocol", slug));

  useEffect(() => {
    setTab("Overview");
    setWatched(isWatched("protocol", slug));
  }, [slug]);

  const category = useMemo(() => {
    const c = data?.protocol.category ?? "other";
    return CATEGORY_LABELS[c as ProtocolCategoryFilter] ?? c;
  }, [data]);

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;
  if (!data) return <div className="text-sm text-ink-400">Protocol not found.</div>;

  const { protocol } = data;
  const pill = CATEGORY_PILL[protocol.category] ?? CATEGORY_PILL.other;

  const toggleWatch = () => {
    toggleWatchItem("protocol", slug);
    setWatched(isWatched("protocol", slug));
  };

  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      // ignore
    }
  };

  const overviewRows = data.paymentStats
    ? [
        { k: "Category", v: category },
        { k: "Launched", v: data.age ? `${data.age} ago` : "—" },
        { k: "Lifetime Calls", v: compact(data.paymentStats.lifetimeCalls) },
        { k: "Logged Send Volume", v: `${usd(data.paymentStats.loggedVolumeUsd)} (attribution)` },
        { k: "Real Router Receive", v: usd(data.paymentStats.routerReceivedUsd) },
        { k: "Real Router Send", v: usd(data.paymentStats.routerSentUsd) },
        { k: "Unique Recipients", v: compact(data.paymentStats.uniqueRecipients ?? 0) },
        { k: "Router TVL", v: usd(data.tvlUsd) },
      ]
    : [
        { k: "Category", v: category },
        { k: "Launched", v: data.age ? `${data.age} ago` : "—" },
        { k: "TVL Rank", v: `#${data.rank}` },
        { k: "24h Fees", v: usd(data.fees24h) },
        { k: "Contracts", v: String(protocol.contracts.length) },
        { k: "24h Volume", v: usd(data.volume24h) },
      ];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <Link to={paths.ecosystem} className="hover:text-arc-600">
          Ecosystem
        </Link>
        <span>/</span>
        <span className="text-ink-700">{protocol.name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ProtocolIcon slug={protocol.slug} name={protocol.name} category={protocol.category} size={48} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-semibold text-ink-900">{protocol.name}</h1>
              <Icons.Verified size={16} className="text-sky-500" />
              <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${pill}`}>
                {category}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-500">
              {protocol.description ?? `${protocol.name} protocol on Arc Testnet.`}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-500">
              {protocol.website && (
                <a
                  href={protocol.website}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-arc-600"
                >
                  <Icons.Globe size={12} /> Website
                </a>
              )}
              {protocol.docs && (
                <a
                  href={protocol.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-arc-600"
                >
                  <Icons.Docs size={12} /> Docs
                </a>
              )}
              {protocol.twitter && (
                <a
                  href={protocol.twitter}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-arc-600"
                >
                  <Icons.X size={12} /> X
                </a>
              )}
              {protocol.discord && (
                <a
                  href={protocol.discord}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 hover:text-arc-600"
                >
                  <Icons.Discord size={12} /> Discord
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={toggleWatch}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400"
          >
            {watched ? <Icons.StarFilled size={13} className="text-amber-500" /> : <Icons.Star size={13} />}
            {watched ? "Watchlisted" : "Add to Watchlist"}
          </button>
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400"
          >
            <Icons.Share size={13} /> Share
          </button>
        </div>
      </div>

      {data.paymentStats ? (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Lifetime Calls"
            value={compact(data.paymentStats.lifetimeCalls)}
            series={data.tvlSpark}
            color="#3b82f6"
          />
          <Kpi
            label="Logged Send Volume"
            value={usd(data.paymentStats.loggedVolumeUsd)}
            series={data.volSpark}
            color="#8b5cf6"
          />
          <Kpi
            label="Real Router Receive"
            value={usd(data.paymentStats.routerReceivedUsd)}
            series={data.feeSpark}
            color="#10b981"
          />
          <Kpi
            label="Real Router Send"
            value={usd(data.paymentStats.routerSentUsd)}
            series={data.userSpark}
            color="#f97316"
          />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="TVL" value={usd(data.tvlUsd)} change={data.change24h} series={data.tvlSpark} color="#3b82f6" />
          <Kpi label="24h Volume" value={usd(data.volume24h)} change={data.changeVol} series={data.volSpark} color="#8b5cf6" />
          <Kpi label="24h Fees" value={usd(data.fees24h)} change={data.changeFees} series={data.feeSpark} color="#f97316" />
          <Kpi
            label="Active Users (24h)"
            value={compact(data.activeUsers)}
            change={data.changeUsers}
            series={data.userSpark}
            color="#10b981"
          />
        </div>
      )}

      <div className="flex gap-0.5 overflow-x-auto border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2 text-[12px] font-medium transition ${
              tab === t
                ? "border-arc-600 text-arc-700"
                : "border-transparent text-ink-400 hover:text-ink-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {(tab === "Overview" || tab === "Analytics") && (
        <>
          <div className="grid gap-2 xl:grid-cols-3">
            <AreaChartCard title="TVL" data={data.tvlSeries} color="#3b82f6" />
            <BarChartCard title="Volume" data={data.volSeries} color="#8b5cf6" />
            <div className="card p-2.5">
              <div className="panel-title mb-2">Overview</div>
              <div className="divide-y divide-ink-100">
                {overviewRows.map((r) => (
                  <div key={r.k} className="flex items-center justify-between gap-2 py-1.5 text-[12px]">
                    <span className="text-ink-400">{r.k}</span>
                    <span className="font-medium text-ink-800">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-3">
            <DonutChart title="TVL Breakdown" slices={data.breakdown} />
            <div className="table-wrap lg:col-span-1">
              <div className="flex items-center justify-between border-b border-ink-100 px-2.5 py-2">
                <div className="panel-title">Top Contracts</div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Contract</th>
                    <th>Type</th>
                    <th>TVL</th>
                  </tr>
                </thead>
                <tbody>
                  {data.contracts.map((c) => (
                    <tr key={c.address}>
                      <td>
                        <div className="font-medium text-ink-800">{c.label}</div>
                        <div className="font-mono text-[10px] text-ink-400">
                          {shortHash(c.address)}
                        </div>
                      </td>
                      <td>
                        <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">
                          {ROLE_LABEL[c.role] ?? c.role}
                        </span>
                      </td>
                      <td className="font-medium">{usd(c.tvlUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="table-wrap">
              <div className="flex items-center justify-between border-b border-ink-100 px-2.5 py-2">
                <div className="panel-title">Top Pairs</div>
                <span className="text-[11px] text-arc-600">View All</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Pair</th>
                    <th>24h Volume</th>
                    <th>APR</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pairs.length ? (
                    data.pairs.map((p) => (
                      <tr key={p.pair}>
                        <td className="font-medium text-ink-800">{p.pair}</td>
                        <td>{usd(p.volume24h)}</td>
                        <td className="text-emerald-600">
                          {p.apr < 0.01 ? p.apr.toFixed(3) : p.apr < 1 ? p.apr.toFixed(2) : p.apr.toFixed(1)}%
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center text-ink-400">
                        No pairs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-2 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <MultiLineChart
                title="Protocol Activity"
                series={[
                  { label: "Transactions", color: "#3b82f6", data: data.activity.txs },
                  { label: "Transfers", color: "#8b5cf6", data: data.activity.transfers },
                  { label: "Active Users", color: "#10b981", data: data.activity.unique },
                ]}
              />
            </div>
            <div className="table-wrap xl:col-span-2">
              <div className="border-b border-ink-100 px-2.5 py-2">
                <div className="panel-title">Latest Transactions</div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Hash</th>
                    <th>Type</th>
                    <th>From</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {data.txs.length ? (
                    data.txs.map((tx) => {
                      const hash = String(tx.hash ?? "");
                      const from = tx.from as { hash?: string } | string | undefined;
                      const fromHash = typeof from === "string" ? from : from?.hash ?? "";
                      return (
                        <tr key={hash}>
                          <td className="font-mono text-[11px] text-arc-600">{shortHash(hash)}</td>
                          <td>
                            <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
                              {String(tx._contract ?? "Tx")}
                            </span>
                          </td>
                          <td className="font-mono text-[11px] text-ink-500">
                            {shortHash(fromHash)}
                          </td>
                          <td className="text-[11px] text-ink-400">
                            {tx.timestamp ? ago(String(tx.timestamp)) : "—"}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="text-center text-ink-400">
                        No recent txs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === "Contracts" && (
        <div className="table-wrap">
          <div className="border-b border-ink-100 px-2.5 py-2">
            <div className="panel-title">Contracts</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Role</th>
                <th>Address</th>
                <th>TVL</th>
              </tr>
            </thead>
            <tbody>
              {data.contracts.map((c) => (
                <tr key={c.address}>
                  <td className="font-medium text-ink-800">{c.label}</td>
                  <td className="capitalize text-ink-500">{ROLE_LABEL[c.role] ?? c.role}</td>
                  <td className="font-mono text-[11px] text-ink-500">{c.address}</td>
                  <td>{usd(c.tvlUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Pools" && (
        <div className="table-wrap">
          <div className="border-b border-ink-100 px-2.5 py-2">
            <div className="panel-title">Pools / Pairs</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Pair</th>
                <th>24h Volume</th>
                <th>APR</th>
              </tr>
            </thead>
            <tbody>
              {data.pairs.length ? (
                data.pairs.map((p) => (
                  <tr key={p.pair}>
                    <td className="font-medium">{p.pair}</td>
                    <td>{usd(p.volume24h)}</td>
                    <td className="text-emerald-600">
                      {p.apr < 0.01 ? p.apr.toFixed(3) : p.apr < 1 ? p.apr.toFixed(2) : p.apr.toFixed(1)}%
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="text-center text-ink-400">
                    No pools for this protocol
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Transactions" && (
        <div className="table-wrap">
          <div className="border-b border-ink-100 px-2.5 py-2">
            <div className="panel-title">Latest Transactions</div>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Hash</th>
                <th>Type</th>
                <th>From</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {data.txs.map((tx) => {
                const hash = String(tx.hash ?? "");
                const from = tx.from as { hash?: string } | string | undefined;
                const fromHash = typeof from === "string" ? from : from?.hash ?? "";
                return (
                  <tr key={hash}>
                    <td className="font-mono text-[11px]">{shortHash(hash, 10, 8)}</td>
                    <td>{String(tx._contract ?? "Tx")}</td>
                    <td className="font-mono text-[11px]">{shortHash(fromHash)}</td>
                    <td>{tx.timestamp ? ago(String(tx.timestamp)) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === "Users" && (
        <div className="grid gap-2 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <AreaChartCard title="Active Users" data={data.activity.unique} color="#10b981" />
          </div>
          <div className="card p-2.5">
            <div className="panel-title mb-2">Users</div>
            <div className="divide-y divide-ink-100 text-[12px]">
              <div className="flex justify-between py-1.5">
                <span className="text-ink-400">Active (24h)</span>
                <span className="font-medium text-ink-800">{compact(data.activeUsers)}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-400">Peak (30d sample)</span>
                <span className="font-medium text-ink-800">
                  {compact(Math.max(...data.activity.unique.map((d) => d.value), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {(tab === "Agents" || tab === "Tokenomics") && (
        <div className="card p-4 text-sm text-ink-400">
          {tab} data for {protocol.name} is coming soon.
        </div>
      )}

      {tab === "About" && (
        <div className="card p-4">
          <div className="panel-title">{protocol.name}</div>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-600">
            {protocol.description ?? `${protocol.name} on Arc Testnet.`}
          </p>
          <div className="mt-3 space-y-1 text-[12px] text-ink-500">
            <div>Category: {category}</div>
            <div>Contracts: {protocol.contracts.length}</div>
            {protocol.website && (
              <a href={protocol.website} target="_blank" rel="noreferrer" className="text-arc-600">
                {protocol.website}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
