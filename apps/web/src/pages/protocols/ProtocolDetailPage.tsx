import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { getProtocol } from "@arclytics/protocols";
import { AreaChartCard, BarChartCard, DonutChart, MultiLineChart } from "@/components/charts/Charts";
import { Icons } from "@/components/shared/Icons";
import { PageNav } from "@/components/shared/PageNav";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import { ChartSkel, Skel } from "@/components/shared/Skel";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { CATEGORY_PILL } from "@/config/ecosystem";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadProtocolDetail, getProtocolRankings, type ProtocolDetail } from "@/libs/api";
import { fetchProtocolTxBatch, loadProtocolLiveTxs, type PageParams, type ProtocolContract, type ProtocolLiveTx } from "@/libs/arcscan";
import { explorerUrl } from "@/config/network";
import { isWatched, subscribeWatch, toggleWatch as toggleWatchItem } from "@/libs/watchlist";
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
const TX_PAGE = 15;

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
  const id = `ps-${color.replace("#", "")}`;
  return (
    <svg className="mt-1 w-full" height="20" viewBox="0 0 100 20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,20 ${line} 100,20`} fill={`url(#${id})`} />
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
  loading,
}: {
  label: string;
  value: string;
  change?: number;
  series: number[];
  color: string;
  loading?: boolean;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <div className="card-pad">
      <div className="text-[10px] text-ink-500">{label}</div>
      {loading ? (
        <>
          <Skel className="mt-1 h-4 w-20" />
          <Skel className="mt-1.5 h-5 w-full" />
        </>
      ) : (
        <>
          <div className="mt-0.5 flex items-baseline justify-between gap-2">
            <div className="text-[15px] font-semibold text-ink-900">{value}</div>
            {change != null && (
              <span className={up ? "badge-up" : "badge-down"}>
                {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
              </span>
            )}
          </div>
          {series.length > 1 && <Spark series={series} color={color} />}
        </>
      )}
    </div>
  );
}

function Val({ ready, children }: { ready: boolean; children: ReactNode }) {
  if (!ready) return <Skel className="h-3 w-14" />;
  return <span className="font-medium text-ink-800">{children}</span>;
}

function TrSkel({ cols, n = 5 }: { cols: number; n?: number }) {
  return (
    <>
      {Array.from({ length: n }, (_, i) => (
        <tr key={i}>
          {Array.from({ length: cols }, (_, j) => (
            <td key={j}>
              <Skel className={`h-3.5 ${j === 0 ? "w-24" : "w-12"}`} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function ChartOrSkel({
  loading,
  has,
  skel,
  children,
}: {
  loading: boolean;
  has: boolean;
  skel: ReactNode;
  children: ReactNode;
}) {
  if (loading) return skel;
  if (has) return children;
  return <div className="card flex h-[180px] items-center justify-center text-sm text-ink-400">No data</div>;
}

export function ProtocolDetailPage() {
  const { slug = "" } = useParams();
  const cfg = getProtocol(slug);
  const rankQ = useAsyncData("protocol-rankings-v11", () => getProtocolRankings().catch(() => []));
  const detailQ = useAsyncData(`protocol-detail-v6:${slug}`, () => loadProtocolDetail(slug), [slug]);
  const previewQ = useAsyncData(`protocol-live-txs-preview:${slug}`, () => loadProtocolLiveTxs(cfg?.contracts ?? [], 5), [slug]);
  const [tab, setTab] = useState<Tab>("Overview");
  const [watched, setWatched] = useState(() => isWatched("protocol", slug));

  useEffect(() => {
    setTab("Overview");
    setWatched(isWatched("protocol", slug));
    return subscribeWatch(() => setWatched(isWatched("protocol", slug)));
  }, [slug]);

  const data = detailQ.data;
  const row = useMemo(() => rankQ.data?.find((r) => r.slug === slug), [rankQ.data, slug]);
  const protocol = data?.protocol ?? cfg;
  const category = useMemo(() => {
    const c = protocol?.category ?? "other";
    return CATEGORY_LABELS[c as ProtocolCategoryFilter] ?? c;
  }, [protocol]);

  if (!protocol && !detailQ.loading) {
    return <div className="text-sm text-ink-400">{detailQ.error ?? "Protocol not found."}</div>;
  }

  const name = protocol?.name ?? slug;
  const pill = CATEGORY_PILL[protocol?.category ?? "other"] ?? CATEGORY_PILL.other;
  const kpisReady = Boolean(data || row);
  const chartsLoading = detailQ.loading && !data;
  const pay = data?.paymentStats;
  const rankNum = data?.rank ?? (row && rankQ.data ? rankQ.data.filter((r) => r.tvlUsd > row.tvlUsd).length + 1 : null);

  const overviewRows = pay
    ? [
        { k: "Category", v: category, ready: true },
        { k: "Launched", v: data?.age ? `${data.age} ago` : "—", ready: Boolean(data) },
        { k: "Lifetime Calls", v: compact(pay.lifetimeCalls), ready: true },
        { k: "Logged Send Volume", v: `${usd(pay.loggedVolumeUsd)} (attribution)`, ready: true },
        { k: "Real Router Receive", v: usd(pay.routerReceivedUsd), ready: true },
        { k: "Real Router Send", v: usd(pay.routerSentUsd), ready: true },
        { k: "Unique Recipients", v: compact(pay.uniqueRecipients ?? 0), ready: true },
        { k: "Router TVL", v: usd(data?.tvlUsd ?? 0), ready: true },
      ]
    : [
        { k: "Category", v: category, ready: Boolean(protocol) },
        { k: "Launched", v: data?.age ? `${data.age} ago` : "—", ready: Boolean(data) },
        { k: "TVL Rank", v: rankNum != null ? `#${rankNum}` : "—", ready: rankNum != null },
        { k: "24h Fees", v: usd(data?.fees24h ?? row?.fees24h ?? 0), ready: kpisReady },
        { k: "Contracts", v: String(protocol?.contracts.length ?? "—"), ready: Boolean(protocol) },
        { k: "24h Volume", v: usd(data?.volume24h ?? row?.volume24h ?? 0), ready: kpisReady },
      ];

  return (
    <div className="space-y-2.5">
      <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-ink-400">
        <Link to={paths.ecosystem} className="shrink-0 hover:text-arc-600">
          Ecosystem
        </Link>
        <span className="shrink-0">/</span>
        {protocol ? <span className="truncate text-ink-700">{name}</span> : <Skel className="h-3 w-24" />}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {protocol ? (
            <ProtocolIcon slug={protocol.slug} name={protocol.name} category={protocol.category} size={48} />
          ) : (
            <Skel className="h-12 w-12 shrink-0 rounded-xl" />
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {protocol ? (
                <>
                  <h1 className="text-lg font-semibold text-ink-900">{protocol.name}</h1>
                  <Icons.Verified size={16} className="text-sky-500" />
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${pill}`}>{category}</span>
                </>
              ) : (
                <>
                  <Skel className="h-5 w-32" />
                  <Skel className="h-4 w-14 rounded-md" />
                </>
              )}
            </div>
            {protocol ? (
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-ink-500">
                {protocol.description ?? `${protocol.name} protocol on Arc Testnet.`}
              </p>
            ) : (
              <Skel className="mt-2 h-3 w-72" />
            )}
            <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-ink-500">
              {protocol?.website && (
                <a href={protocol.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-arc-600">
                  <Icons.Globe size={12} /> Website
                </a>
              )}
              {protocol?.docs && (
                <a href={protocol.docs} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-arc-600">
                  <Icons.Docs size={12} /> Docs
                </a>
              )}
              {protocol?.twitter && (
                <a href={protocol.twitter} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-arc-600">
                  <Icons.X size={12} /> X
                </a>
              )}
              {protocol?.discord && (
                <a href={protocol.discord} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-arc-600">
                  <Icons.Discord size={12} /> Discord
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <button
            type="button"
            onClick={() => void toggleWatchItem("protocol", slug)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400 dark:border-[var(--line)] dark:bg-[var(--surface-1)] dark:text-ink-300"
          >
            {watched ? <Icons.StarFilled size={13} className="text-amber-500" /> : <Icons.Star size={13} />}
            {watched ? "Watchlisted" : "Add to Watchlist"}
          </button>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(window.location.href).catch(() => undefined)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink-700 hover:border-arc-400 dark:border-[var(--line)] dark:bg-[var(--surface-1)] dark:text-ink-300"
          >
            <Icons.Share size={13} /> Share
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {pay ? (
          <>
            <Kpi label="Lifetime Calls" value={compact(pay.lifetimeCalls)} series={data?.tvlSpark ?? []} color="#3b82f6" />
            <Kpi label="Logged Send Volume" value={usd(pay.loggedVolumeUsd)} series={data?.volSpark ?? []} color="#8b5cf6" />
            <Kpi label="Real Router Receive" value={usd(pay.routerReceivedUsd)} series={data?.feeSpark ?? []} color="#10b981" />
            <Kpi label="Real Router Send" value={usd(pay.routerSentUsd)} series={data?.userSpark ?? []} color="#f97316" />
          </>
        ) : (
          <>
            <Kpi label="TVL" value={usd(data?.tvlUsd ?? row?.tvlUsd ?? 0)} change={data?.change24h ?? row?.change24h} series={data?.tvlSpark ?? row?.spark7d ?? []} color="#3b82f6" loading={!kpisReady} />
            <Kpi label="24h Volume" value={usd(data?.volume24h ?? row?.volume24h ?? 0)} change={data?.changeVol} series={data?.volSpark ?? row?.spark7d ?? []} color="#8b5cf6" loading={!kpisReady} />
            <Kpi label="24h Fees" value={usd(data?.fees24h ?? row?.fees24h ?? 0)} change={data?.changeFees} series={data?.feeSpark ?? []} color="#f97316" loading={!kpisReady} />
            <Kpi label="Active Users (24h)" value={compact(data?.activeUsers ?? row?.activeUsers24h ?? 0)} change={data?.changeUsers} series={data?.userSpark ?? []} color="#10b981" loading={!kpisReady} />
          </>
        )}
      </div>

      <div className="no-scrollbar flex gap-0.5 overflow-x-auto border-b border-ink-200">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`shrink-0 border-b-2 px-3 py-2 text-[12px] font-medium transition ${
              tab === t ? "border-arc-600 text-arc-700" : "border-transparent text-ink-400 hover:text-ink-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {(tab === "Overview" || tab === "Analytics") && (
        <>
          <div className="grid min-w-0 gap-2 xl:grid-cols-3">
            <ChartOrSkel loading={chartsLoading} has={Boolean(data?.tvlSeries.length)} skel={<ChartSkel title="TVL" kind="area" />}>
              {data && <AreaChartCard title="TVL" data={data.tvlSeries} color="#3b82f6" />}
            </ChartOrSkel>
            <ChartOrSkel loading={chartsLoading} has={Boolean(data?.volSeries.length)} skel={<ChartSkel title="Volume" kind="bar" />}>
              {data && <BarChartCard title="Volume" data={data.volSeries} color="#8b5cf6" />}
            </ChartOrSkel>
            <div className="card p-2.5">
              <div className="panel-title mb-2">Overview</div>
              <div className="divide-y divide-ink-100">
                {overviewRows.map((r) => (
                  <div key={r.k} className="flex items-center justify-between gap-2 py-1.5 text-[12px]">
                    <span className="text-ink-400">{r.k}</span>
                    <Val ready={r.ready}>{r.v}</Val>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid min-w-0 gap-2 lg:grid-cols-3">
            {chartsLoading ? (
              <div className="card p-2.5">
                <div className="panel-title mb-2">TVL Breakdown</div>
                <div className="flex items-center gap-4 py-4">
                  <Skel className="h-[120px] w-[120px] shrink-0 rounded-full" />
                  <div className="min-w-0 flex-1 space-y-2">
                    {Array.from({ length: 3 }, (_, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <Skel className="h-3 w-20" />
                        <Skel className="h-3 w-10" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <DonutChart title="TVL Breakdown" slices={data?.breakdown ?? []} />
            )}
            <ContractTable rows={data?.contracts} fallback={protocol?.contracts} loading={chartsLoading} />
            <PairsTable rows={data?.pairs} loading={chartsLoading} />
          </div>

          <div className="grid min-w-0 gap-2 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              <ChartOrSkel
                loading={chartsLoading}
                has={Boolean(data?.activity.txs.length || data?.activity.transfers.length)}
                skel={<ChartSkel title="Protocol Activity" kind="area" />}
              >
                {data && (
                  <MultiLineChart
                    title="Protocol Activity"
                    series={[
                      { label: "Transactions", color: "#3b82f6", data: data.activity.txs },
                      { label: "Transfers", color: "#8b5cf6", data: data.activity.transfers },
                      { label: "Active Users", color: "#10b981", data: data.activity.unique },
                    ]}
                  />
                )}
              </ChartOrSkel>
            </div>
            <TxTable
              rows={previewQ.data}
              loading={previewQ.loading && !previewQ.data}
              className="xl:col-span-2"
              onViewAll={() => setTab("Transactions")}
            />
          </div>
        </>
      )}

      {tab === "Contracts" && <ContractTable rows={data?.contracts} fallback={protocol?.contracts} loading={chartsLoading} wide />}
      {tab === "Pools" && <PairsTable rows={data?.pairs} loading={chartsLoading} wide />}
      {tab === "Transactions" && <ProtocolTxTab slug={slug} contracts={cfg?.contracts ?? []} />}

      {tab === "Users" && (
        <div className="grid min-w-0 gap-2 xl:grid-cols-3">
          <div className="min-w-0 xl:col-span-2">
            <ChartOrSkel loading={chartsLoading} has={Boolean(data?.activity.unique.length)} skel={<ChartSkel title="Active Users" kind="area" />}>
              {data && <AreaChartCard title="Active Users" data={data.activity.unique} color="#10b981" />}
            </ChartOrSkel>
          </div>
          <div className="card p-2.5">
            <div className="panel-title mb-2">Users</div>
            <div className="divide-y divide-ink-100 text-[12px]">
              <div className="flex justify-between py-1.5">
                <span className="text-ink-400">Active (24h)</span>
                <Val ready={kpisReady}>{compact(data?.activeUsers ?? row?.activeUsers24h ?? 0)}</Val>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-ink-400">Peak (30d sample)</span>
                <Val ready={Boolean(data)}>{compact(Math.max(...(data?.activity.unique.map((d) => d.value) ?? [0]), 0))}</Val>
              </div>
            </div>
          </div>
        </div>
      )}

      {(tab === "Agents" || tab === "Tokenomics") && (
        <div className="card p-4 text-sm text-ink-400">{tab} data for {name} is coming soon.</div>
      )}

      {tab === "About" && (
        <div className="card p-4">
          <div className="panel-title">{name}</div>
          {protocol ? (
            <>
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
            </>
          ) : (
            <Skel className="mt-2 h-16 w-full" />
          )}
        </div>
      )}
    </div>
  );
}

function ContractTable({
  rows,
  fallback,
  loading,
  wide,
}: {
  rows?: ProtocolDetail["contracts"];
  fallback?: Array<{ address: string; role: string; label?: string }>;
  loading: boolean;
  wide?: boolean;
}) {
  const list = rows?.length ? rows : fallback?.map((c) => ({ ...c, label: c.label ?? c.role, tvlUsd: 0, txs: 0, transfers: 0 }));
  return (
    <div className={`table-wrap min-w-0 ${wide ? "" : "lg:col-span-1"}`}>
      <div className="border-b border-ink-100 px-2.5 py-2">
        <div className="panel-title">{wide ? "Contracts" : "Top Contracts"}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[420px]">
          <thead>
            <tr>
              <th>{wide ? "Label" : "Contract"}</th>
              <th>{wide ? "Role" : "Type"}</th>
              {wide && <th>Address</th>}
              <th>TVL</th>
            </tr>
          </thead>
          <tbody>
            {loading && !list?.length ? (
              <TrSkel cols={wide ? 4 : 3} />
            ) : list?.length ? (
              list.map((c) => (
                <tr key={c.address}>
                  <td>
                    <div className="font-medium text-ink-800">{c.label}</div>
                    {!wide && <div className="font-mono text-[10px] text-ink-400">{shortHash(c.address)}</div>}
                  </td>
                  <td>
                    {wide ? (
                      <span className="capitalize text-ink-500">{ROLE_LABEL[c.role] ?? c.role}</span>
                    ) : (
                      <span className="rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] text-ink-600">{ROLE_LABEL[c.role] ?? c.role}</span>
                    )}
                  </td>
                  {wide && <td className="font-mono text-[11px] text-ink-500">{c.address}</td>}
                  <td className="font-medium">{rows ? usd(c.tvlUsd) : <Skel className="h-3 w-12" />}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={wide ? 4 : 3} className="text-center text-ink-400">
                  No contracts
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PairsTable({ rows, loading, wide }: { rows?: ProtocolDetail["pairs"]; loading: boolean; wide?: boolean }) {
  return (
    <div className="table-wrap min-w-0">
      <div className="flex items-center justify-between border-b border-ink-100 px-2.5 py-2">
        <div className="panel-title">{wide ? "Pools / Pairs" : "Top Pairs"}</div>
        {!wide && <span className="text-[11px] text-arc-600">View All</span>}
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[360px]">
          <thead>
            <tr>
              <th>Pair</th>
              <th>24h Volume</th>
              <th>APR</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TrSkel cols={3} />
            ) : rows?.length ? (
              rows.map((p) => (
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
  );
}

function ProtocolTxTab({ slug, contracts }: { slug: string; contracts: ProtocolContract[] }) {
  const list = useRef(contracts);
  list.current = contracts;
  const buf = useRef<ProtocolLiveTx[]>([]);
  const seen = useRef(new Set<string>());
  const cursors = useRef<Record<string, PageParams>>({});
  const first = useRef(true);
  const gen = useRef(0);
  const busy = useRef(false);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<ProtocolLiveTx[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const key = `${slug}:${contracts.map((c) => c.address.toLowerCase()).join(",")}`;

  async function load(g: number, index: number) {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    try {
      while (buf.current.length < (index + 1) * TX_PAGE && (first.current || Object.keys(cursors.current).length)) {
        const { items: more, next } = await fetchProtocolTxBatch(list.current, first.current ? null : cursors.current);
        first.current = false;
        cursors.current = next;
        let added = 0;
        for (const tx of more) {
          if (!tx.hash || seen.current.has(tx.hash)) continue;
          seen.current.add(tx.hash);
          buf.current.push(tx);
          added += 1;
        }
        buf.current.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        if (!added) break;
      }
      if (g !== gen.current) return;
      setItems(buf.current.slice(index * TX_PAGE, (index + 1) * TX_PAGE));
      setPage(index);
      setHasMore(buf.current.length > (index + 1) * TX_PAGE || Object.keys(cursors.current).length > 0);
    } finally {
      if (g === gen.current) {
        busy.current = false;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    const g = ++gen.current;
    buf.current = [];
    seen.current = new Set();
    cursors.current = {};
    first.current = true;
    busy.current = false;
    setItems([]);
    setPage(0);
    setHasMore(false);
    void load(g, 0);
    return () => {
      gen.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const boot = loading && !items.length;
  return (
    <TxTable
      rows={items}
      loading={boot}
      wide
      page={page + 1}
      hasPrev={page > 0}
      hasNext={hasMore}
      navLoading={loading}
      onPrev={() => page > 0 && !loading && void load(gen.current, page - 1)}
      onNext={() => hasMore && !loading && void load(gen.current, page + 1)}
    />
  );
}

function TxTable({
  rows,
  loading,
  wide,
  className = "",
  onViewAll,
  page,
  hasPrev,
  hasNext,
  navLoading,
  onPrev,
  onNext,
}: {
  rows?: ProtocolLiveTx[] | null;
  loading: boolean;
  wide?: boolean;
  className?: string;
  onViewAll?: () => void;
  page?: number;
  hasPrev?: boolean;
  hasNext?: boolean;
  navLoading?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const paged = page != null && onPrev && onNext;
  return (
    <div className={`table-wrap min-w-0 ${className}`}>
      <div className="flex items-center justify-between gap-2 border-b border-ink-100 px-2.5 py-2">
        <div className="panel-title">Latest Transactions</div>
        {onViewAll && (
          <button type="button" onClick={onViewAll} className="shrink-0 text-[11px] font-medium text-arc-600 hover:text-arc-700">
            View all
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-[520px]">
          <thead>
            <tr>
              <th>Hash</th>
              <th>Type</th>
              <th>From</th>
              {wide && <th>To</th>}
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TrSkel cols={wide ? 5 : 4} n={wide ? TX_PAGE : 5} />
            ) : rows?.length ? (
              rows.map((tx) => (
                <tr key={tx.hash}>
                  <td>
                    <a
                      href={explorerUrl(`/tx/${tx.hash}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-arc-600 hover:underline"
                    >
                      {shortHash(tx.hash, wide ? 10 : 6, wide ? 8 : 4)}
                    </a>
                  </td>
                  <td>
                    <span className="inline-block max-w-[9rem] truncate rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] text-violet-700">
                      {tx.method}
                    </span>
                    <div className="mt-0.5 truncate text-[10px] text-ink-400">{tx.contract}</div>
                  </td>
                  <td>
                    <a
                      href={explorerUrl(`/address/${tx.from}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-[11px] text-ink-500 hover:text-arc-600"
                    >
                      {shortHash(tx.from)}
                    </a>
                  </td>
                  {wide && (
                    <td>
                      <a
                        href={explorerUrl(`/address/${tx.to}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[11px] text-ink-500 hover:text-arc-600"
                      >
                        {shortHash(tx.to)}
                      </a>
                    </td>
                  )}
                  <td className="text-[11px] text-ink-400">{tx.timestamp ? ago(tx.timestamp) : "—"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={wide ? 5 : 4} className="text-center text-ink-400">
                  No recent txs
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {paged && (
        <div className="border-t border-ink-100 px-2 pb-2">
          <PageNav
            page={page}
            hasPrev={Boolean(hasPrev)}
            hasNext={Boolean(hasNext)}
            loading={navLoading}
            onPrev={onPrev}
            onNext={onNext}
            pageSize={rows?.length}
          />
        </div>
      )}
    </div>
  );
}
