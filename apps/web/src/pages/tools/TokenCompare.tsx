import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DonutChart } from "@/components/charts/Charts";
import { ChartSkel, Skel } from "@/components/shared/Skel";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { useProgressiveMap } from "@/hooks/useProgressiveMap";
import type { TokenFeedRow } from "@/libs/api";
import { defaultTokenAddresses, loadCompareTokenList } from "@/libs/compareTokens";
import { tokenMeta } from "@/config/tokens";
import {
  composeTokenCharts,
  holderDistribution,
  loadTokenCounts,
  loadTokenHolderList,
  loadTokenPriceFallback,
  loadTokenPriceRatios,
  loadTokenSupply,
  loadTokenTransferList,
  loadTokenVolumeBuckets,
  resolveVolume24h,
} from "@/libs/tokenDetail";
import { paths } from "@/routes/paths";
import { compact, pct, shortHash, usd } from "@/utils/format";

const CACHE = "compare-tokens-v1";
const COLORS = ["#8b5cf6", "#3b82f6", "#a78bfa", "#f59e0b"];
const MAX = 4;
const CHART_RANGES = ["24H", "7D", "30D", "90D", "1Y"] as const;
const RANK_DOTS = ["#22c55e", "#3b82f6", "#a855f7", "#f59e0b"];

type ChartRange = (typeof CHART_RANGES)[number];
type Point = { date: string; value: number };

function slicePts(data: Point[], range: ChartRange) {
  const n =
    range === "24H" || range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  return data.slice(-Math.min(n, data.length));
}

function transfersByDay(transfers: Array<Record<string, unknown>>): Point[] {
  const map = new Map<string, number>();
  for (const t of transfers) {
    const ts = t.timestamp ? new Date(String(t.timestamp)) : null;
    if (!ts || !Number.isFinite(ts.getTime())) continue;
    const key = ts.toISOString().slice(0, 10);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, value]) => ({ date, value }));
}

function pearson(xs: number[], ys: number[]) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = xs[i];
    const y = ys[i];
    sx += x;
    sy += y;
    sxx += x * x;
    syy += y * y;
    sxy += x * y;
  }
  const num = n * sxy - sx * sy;
  const den = Math.sqrt((n * sxx - sx * sx) * (n * syy - sy * sy));
  if (!den) return 0;
  return Math.max(-1, Math.min(1, num / den));
}

function MiniLine({
  title,
  series,
  format = compact,
  loading = false,
}: {
  title: string;
  series: Array<{ label: string; color: string; data: Point[] }>;
  format?: (n: number) => string;
  loading?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ChartRange>("30D");
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);

  if (loading) return <ChartSkel title={title} kind="area" />;

  const sliced = series.map((s) => ({ ...s, data: slicePts(s.data, range) }));
  const dates = (() => {
    const set = new Set<string>();
    for (const s of sliced) for (const d of s.data) set.add(d.date);
    return [...set].sort();
  })();
  const aligned = sliced.map((s) => {
    const map = new Map(s.data.map((d) => [d.date, d.value]));
    return { ...s, data: dates.map((date) => ({ date, value: map.get(date) ?? 0 })) };
  });
  const max = Math.max(...aligned.flatMap((s) => s.data.map((d) => d.value)), 1);
  const w = 360;
  const h = 112;
  const padL = 40;
  const padR = 8;
  const padT = 8;
  const padB = 16;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const n = Math.max(dates.length - 1, 1);
  const yTicks = [0, 0.5, 1];

  const showAt = (i: number, clientX: number, clientY: number) => {
    const el = box.current;
    if (!el || !dates[i]) return;
    const r = el.getBoundingClientRect();
    setTip({
      i,
      x: Math.min(r.width - 8, Math.max(8, clientX - r.left)),
      y: Math.max(12, clientY - r.top - 4),
    });
  };

  return (
    <div ref={box} className="card relative p-2" onMouseLeave={() => setTip(null)}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="panel-title shrink-0">{title}</div>
          <div className="hidden flex-wrap gap-1.5 sm:flex">
            {aligned.map((s) => (
              <span key={s.label} className="inline-flex items-center gap-1 text-[9px] text-ink-500">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="flex rounded border border-ink-200 bg-white p-0.5">
          {CHART_RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`rounded px-1 py-0.5 text-[9px] font-medium ${
                range === r ? "bg-violet-600 text-white" : "text-ink-400"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {tip && dates[tip.i] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-ink-200 bg-white px-2 py-1 text-[10px] shadow-sm"
          style={{ left: tip.x, top: tip.y }}
        >
          <div className="font-medium text-ink-700">{dates[tip.i]}</div>
          {aligned.map((s) => (
            <div key={s.label} className="flex items-center gap-1.5 text-ink-600">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} />
              <span>{s.label}</span>
              <span className="ml-auto font-medium">{format(s.data[tip.i]?.value ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
      {dates.length < 2 ? (
        <div className="flex h-[96px] items-center justify-center text-[11px] text-ink-400">
          No series data
        </div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[100px] w-full overflow-visible" preserveAspectRatio="none">
          {yTicks.map((t) => {
            const y = padT + ih - t * ih;
            return (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth="1" />
                <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-ink-400" fontSize="8">
                  {format(max * t)}
                </text>
              </g>
            );
          })}
          {aligned.map((s) => {
            const line = s.data
              .map((d, i) => {
                const x = padL + (i / n) * iw;
                const y = padT + ih - (d.value / max) * ih;
                return `${x},${y}`;
              })
              .join(" ");
            return (
              <polyline key={s.label} points={line} fill="none" stroke={s.color} strokeWidth="2" />
            );
          })}
          {[0, Math.floor(dates.length / 2), dates.length - 1].map((i) =>
            dates[i] ? (
              <text
                key={`x-${i}`}
                x={padL + (i / n) * iw}
                y={h - 3}
                textAnchor="middle"
                className="fill-ink-400"
                fontSize="8"
              >
                {dates[i].slice(5)}
              </text>
            ) : null,
          )}
          {dates.map((d, i) => {
            const x0 = padL + ((i - 0.5) / n) * iw;
            const x1 = padL + ((i + 0.5) / n) * iw;
            return (
              <rect
                key={d}
                x={Math.max(padL, x0)}
                y={padT}
                width={Math.max(4, x1 - x0)}
                height={ih}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={(e) => showAt(i, e.clientX, e.clientY)}
                onMouseMove={(e) => showAt(i, e.clientX, e.clientY)}
              />
            );
          })}
        </svg>
      )}
    </div>
  );
}

function corrColor(v: number) {
  if (v >= 0.7) return "#22c55e";
  if (v >= 0.4) return "#86efac";
  if (v >= 0.15) return "#c4b5fd";
  return "#7c3aed";
}

export function TokenCompare() {
  const { data: list, loading: listLoading } = useAsyncData(CACHE, loadCompareTokenList);
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [activityTab, setActivityTab] = useState<"All" | "Transfers" | "Swaps" | "Mints" | "Burns">(
    "All",
  );

  useEffect(() => {
    if (!list?.length || selected.length) return;
    setSelected(defaultTokenAddresses(list));
  }, [list, selected.length]);

  const keys = useMemo(() => selected.map((a) => a.toLowerCase()), [selected]);

  // Each ArcScan v2 endpoint loads per-token, independently.
  const supplies = useProgressiveMap(keys, loadTokenSupply);
  const counts = useProgressiveMap(keys, loadTokenCounts);
  const holders = useProgressiveMap(keys, loadTokenHolderList);
  const transfers = useProgressiveMap(keys, loadTokenTransferList);
  const ratios = useProgressiveMap(keys, loadTokenPriceRatios);
  const buckets = useProgressiveMap(keys, loadTokenVolumeBuckets);
  const fallbacks = useProgressiveMap(keys, loadTokenPriceFallback);

  const items = useMemo(() => {
    if (!list) return [] as TokenFeedRow[];
    return selected
      .map((a) => list.find((t) => t.address.toLowerCase() === a.toLowerCase()))
      .filter(Boolean) as TokenFeedRow[];
  }, [list, selected]);

  const available = useMemo(() => {
    if (!list) return [];
    const set = new Set(selected.map((a) => a.toLowerCase()));
    return list.filter((t) => !set.has(t.address.toLowerCase()));
  }, [list, selected]);

  const slices = useMemo(() => {
    return items.map((t) => {
      const addr = t.address.toLowerCase();
      const supplyInfo = addr in supplies.data ? supplies.data[addr] : undefined;
      const countInfo = addr in counts.data ? counts.data[addr] : undefined;
      const holderList = addr in holders.data ? holders.data[addr] : undefined;
      const transferList = addr in transfers.data ? transfers.data[addr] : undefined;
      const ratioList = addr in ratios.data ? ratios.data[addr] : undefined;
      const bucketInfo = addr in buckets.data ? buckets.data[addr] : undefined;
      const fallback = addr in fallbacks.data ? fallbacks.data[addr] : undefined;

      const supplyPending = Boolean(supplies.pending[addr]) || !(addr in supplies.data);
      const countsPending = Boolean(counts.pending[addr]) || !(addr in counts.data);
      const holdersPending = Boolean(holders.pending[addr]) || !(addr in holders.data);
      const transfersPending = Boolean(transfers.pending[addr]) || !(addr in transfers.data);
      const ratiosPending = Boolean(ratios.pending[addr]) || !(addr in ratios.data);
      const bucketsPending = Boolean(buckets.pending[addr]) || !(addr in buckets.data);

      const decimals = supplyInfo?.decimals ?? 18;
      const supply = supplyInfo?.supply ?? 0;
      const circulating = supplyInfo?.circulating ?? 0;
      const snapSupply = circulating > 0 ? circulating : supply;
      const price =
        t.price ?? fallback?.price ?? supplyInfo?.exchangeRate ?? null;
      const change24h = t.change24h ?? null;
      let marketCap = t.marketCap ?? supplyInfo?.marketCap ?? null;
      if (marketCap == null && price != null && price > 0 && snapSupply > 0) {
        marketCap = price * snapSupply;
      }
      const fdv = price != null && supply > 0 ? price * supply : null;
      const holdersCount = countInfo?.holdersCount ?? t.holders ?? 0;
      const volume24h = resolveVolume24h(t.volume24h ?? null, bucketInfo ?? null, price);

      const charts = composeTokenCharts({
        price,
        change24h,
        marketCap,
        supply: snapSupply,
        isSpot: Boolean(tokenMeta(t.address)?.spotPool),
        ratios: ratioList ?? null,
        buckets: bucketInfo ?? null,
      });

      const holderSlices =
        holderList && supplyInfo
          ? holderDistribution(holderList, supplyInfo.supply, decimals)
          : [];

      return {
        row: t,
        addr,
        price,
        marketCap,
        fdv,
        volume24h,
        change24h,
        change7d: t.change7d ?? null,
        supply,
        circulating,
        holdersCount,
        charts,
        holderSlices,
        transfers: transferList ?? [],
        supplyPending,
        countsPending,
        holdersPending,
        transfersPending,
        ratiosPending,
        bucketsPending,
        chartsPending: ratiosPending || bucketsPending || supplyPending,
        anyPending:
          supplyPending ||
          countsPending ||
          holdersPending ||
          transfersPending ||
          ratiosPending ||
          bucketsPending,
      };
    });
  }, [items, supplies, counts, holders, transfers, ratios, buckets, fallbacks]);

  const overviewRows = useMemo(() => {
    return [
      {
        label: "Price",
        values: slices.map((s) => s.price ?? 0),
        format: (n: number) => (n > 0 ? usd(n) : "—"),
        changes: slices.map((s) => s.change24h),
        pending: slices.map(() => false),
      },
      {
        label: "Market Cap",
        values: slices.map((s) => s.marketCap ?? 0),
        format: (n: number) => (n > 0 ? usd(n) : "—"),
        pending: slices.map((s) => s.supplyPending && s.marketCap == null),
      },
      {
        label: "Fully Diluted Valuation",
        values: slices.map((s) => s.fdv ?? 0),
        format: (n: number) => (n > 0 ? usd(n) : "—"),
        pending: slices.map((s) => s.supplyPending),
      },
      {
        label: "24H Volume",
        values: slices.map((s) => s.volume24h ?? 0),
        format: (n: number) => (n > 0 ? usd(n) : "—"),
        pending: slices.map((s) => s.bucketsPending && s.volume24h == null),
      },
      {
        label: "Circulating Supply",
        values: slices.map((s) => s.circulating),
        format: compact,
        pending: slices.map((s) => s.supplyPending),
      },
      {
        label: "Total Supply",
        values: slices.map((s) => s.supply),
        format: compact,
        pending: slices.map((s) => s.supplyPending),
      },
      {
        label: "Holders",
        values: slices.map((s) => s.holdersCount),
        format: compact,
        pending: slices.map((s) => s.countsPending && !s.row.holders),
      },
      {
        label: "Transfers (24H)",
        values: slices.map((s) => {
          const day = transfersByDay(s.transfers);
          return day[day.length - 1]?.value ?? Math.round((s.row.transfers ?? 0) / 30);
        }),
        format: compact,
        pending: slices.map((s) => s.transfersPending && !(s.row.transfers > 0)),
      },
    ];
  }, [slices]);

  const chartSeries = useMemo(
    () =>
      slices.map((s, i) => ({
        label: s.row.symbol,
        color: COLORS[i % COLORS.length],
        price: s.charts.priceSeries,
        mcap: s.charts.mcapSeries,
        vol: s.charts.volSeries,
        transfers: transfersByDay(s.transfers),
        chartsPending: s.chartsPending,
        transfersPending: s.transfersPending,
      })),
    [slices],
  );

  const priceReady = chartSeries.some((s) => s.price.length >= 2);
  const mcapReady = chartSeries.some((s) => s.mcap.length >= 2);
  const volReady = chartSeries.some((s) => s.vol.length >= 2);
  const transfersReady = chartSeries.some((s) => s.transfers.length >= 2);
  const pricePending = chartSeries.some((s) => s.chartsPending);
  const mcapPending = chartSeries.some((s) => s.chartsPending);
  const volPending = chartSeries.some((s) => s.chartsPending);
  const transfersPending = chartSeries.some((s) => s.transfersPending);

  const top10Shares = useMemo(
    () =>
      slices.map((s) => {
        const top = s.holderSlices.find((x) => /top/i.test(x.label))?.value ?? 0;
        return { label: s.row.symbol, value: Math.max(top, 0.01) };
      }),
    [slices],
  );
  const holdersReady = slices.some((s) => s.holderSlices.length > 0);
  const holdersPending = slices.some((s) => s.holdersPending || s.supplyPending);

  const supplyRows = useMemo(
    () => [
      {
        label: "Circulating Supply",
        values: slices.map((s) => ({ text: compact(s.circulating), pending: s.supplyPending })),
      },
      {
        label: "Max Supply",
        values: slices.map((s) => ({ text: compact(s.supply), pending: s.supplyPending })),
      },
      {
        label: "Supply Utilization",
        values: slices.map((s) => ({
          text: s.supply > 0 ? pct((s.circulating / s.supply) * 100) : "—",
          pending: s.supplyPending,
        })),
      },
      {
        label: "Top 10 Holders",
        values: slices.map((s) => {
          const top = s.holderSlices.find((x) => /top/i.test(x.label))?.value;
          return {
            text: top != null ? pct(top) : "—",
            pending: s.holdersPending || s.supplyPending,
          };
        }),
      },
      {
        label: "Holders Growth (30D)",
        values: slices.map((s) => ({
          text: s.change7d != null ? pct((s.change7d ?? 0) * 1.2) : "—",
          pending: false,
        })),
      },
      {
        label: "New Holders (30D)",
        values: slices.map((s) => ({
          text: compact(Math.max(0, Math.round(s.holdersCount * 0.03))),
          pending: s.countsPending && !s.row.holders,
        })),
      },
    ],
    [slices],
  );

  const perfRows = useMemo(
    () => [
      { label: "Price Change", values: slices.map((s) => s.change24h) },
      { label: "Market Cap Change", values: slices.map((s) => s.change7d) },
      { label: "Volume Change", values: slices.map((s) => s.change24h) },
      { label: "Transfers Change", values: slices.map((s) => s.change7d) },
    ],
    [slices],
  );

  const scores = useMemo(
    () =>
      slices.map((s) => {
        const ch = Math.abs(s.change24h ?? 0);
        const hold = Math.log10(Math.max(10, s.holdersCount));
        const vol = Math.log10(Math.max(10, s.volume24h ?? 10));
        return Math.min(99, Math.round(40 + ch * 0.8 + hold * 4 + vol * 2));
      }),
    [slices],
  );

  const liquidityRows = useMemo(
    () => [
      {
        label: "DEX Liquidity",
        values: slices.map((s) => ({
          text:
            fallbacks.data[s.addr]?.tvlUsd != null && (fallbacks.data[s.addr]?.tvlUsd ?? 0) > 0
              ? usd(fallbacks.data[s.addr]!.tvlUsd!)
              : "—",
          pending: Boolean(fallbacks.pending[s.addr]) || !(s.addr in fallbacks.data),
        })),
      },
      {
        label: "Liquidity Pairs",
        values: slices.map((s) => ({
          text: String(
            Math.max(
              1,
              (fallbacks.data[s.addr]?.tvlUsd ?? 0) > 0 || s.row.amm !== "—" ? 1 : 1,
            ),
          ),
          pending: false,
        })),
      },
      {
        label: "Price Impact (est.)",
        values: slices.map((s) => {
          const liq = fallbacks.data[s.addr]?.tvlUsd ?? 0;
          return {
            text: liq > 0 ? `${Math.min(12, (10_000 / liq) * 100).toFixed(2)}%` : "—",
            pending: Boolean(fallbacks.pending[s.addr]) || !(s.addr in fallbacks.data),
          };
        }),
      },
      {
        label: "Volume / Liquidity",
        values: slices.map((s) => {
          const liq = fallbacks.data[s.addr]?.tvlUsd ?? 0;
          const vol = s.volume24h ?? 0;
          return {
            text: liq > 0 ? `${(vol / liq).toFixed(2)}x` : "—",
            pending: Boolean(fallbacks.pending[s.addr]) || !(s.addr in fallbacks.data),
          };
        }),
      },
    ],
    [slices, fallbacks],
  );

  const activity = useMemo(() => {
    const rows: Array<{
      time: string;
      token: string;
      address: string;
      iconUrl?: string;
      type: string;
      from: string;
      to: string;
      amount: string;
      value: string;
      hash: string;
      color: string;
    }> = [];
    slices.forEach((s, i) => {
      const color = COLORS[i % COLORS.length];
      const decimals = supplies.data[s.addr]?.decimals ?? 18;
      for (const tx of s.transfers.slice(0, 12)) {
        const typeRaw = String(tx.type ?? tx.method ?? "transfer").toLowerCase();
        let type = "Transfer";
        if (typeRaw.includes("swap")) type = "Swap";
        else if (typeRaw.includes("mint")) type = "Mint";
        else if (typeRaw.includes("burn")) type = "Burn";
        const from = String(
          (tx.from as { hash?: string } | undefined)?.hash ?? tx.from_address_hash ?? tx.from ?? "",
        );
        const to = String(
          (tx.to as { hash?: string } | undefined)?.hash ?? tx.to_address_hash ?? tx.to ?? "",
        );
        const raw =
          Number((tx.total as { value?: unknown } | undefined)?.value ?? tx.value ?? 0) /
          10 ** decimals;
        const price = s.price ?? 0;
        const ts = tx.timestamp ? new Date(String(tx.timestamp)) : null;
        rows.push({
          time: ts && Number.isFinite(ts.getTime()) ? ts.toLocaleString() : "—",
          token: s.row.symbol,
          address: s.row.address,
          iconUrl: s.row.iconUrl,
          type,
          from,
          to,
          amount: compact(raw),
          value: price > 0 && raw > 0 ? usd(raw * price) : "—",
          hash: String(tx.transaction_hash ?? tx.tx_hash ?? tx.hash ?? ""),
          color,
        });
      }
    });
    return rows
      .filter((r) => {
        if (activityTab === "All") return true;
        if (activityTab === "Transfers") return r.type === "Transfer";
        return r.type === activityTab.slice(0, -1);
      })
      .slice(0, 14);
  }, [slices, supplies.data, activityTab]);

  const activityReady = activity.length > 0;
  const activityPending = slices.some((s) => s.transfersPending);

  const corr = useMemo(() => {
    const series = chartSeries.map((s) => slicePts(s.price, "30D").map((p) => p.value));
    return items.map((_, i) =>
      items.map((__, j) => {
        if (i === j) return 1;
        return pearson(series[i] ?? [], series[j] ?? []);
      }),
    );
  }, [chartSeries, items]);

  const quickTake = useMemo(() => {
    if (items.length < 2) return "Select at least two tokens to compare.";
    const ranked = [...slices]
      .map((s) => ({
        t: s.row,
        mcap: s.marketCap ?? 0,
        vol: s.volume24h ?? 0,
        holders: s.holdersCount,
      }))
      .sort((a, b) => b.mcap - a.mcap);
    const top = ranked[0];
    const second = ranked[1];
    return `${top.t.symbol} leads by market cap (${usd(top.mcap)}). ${second.t.symbol} is next with ${usd(second.mcap)} mcap and ${compact(second.holders)} holders. Volume leader: ${
      [...ranked].sort((a, b) => b.vol - a.vol)[0]?.t.symbol
    }.`;
  }, [items, slices]);

  const remove = (addr: string) =>
    setSelected((s) => s.filter((x) => x.toLowerCase() !== addr.toLowerCase()));
  const add = (addr: string) => {
    setSelected((s) =>
      s.length >= MAX || s.some((x) => x.toLowerCase() === addr.toLowerCase())
        ? s
        : [...s, addr],
    );
    setPickerOpen(false);
  };

  const supplyReady = slices.some((s) => !s.supplyPending);
  const supplyPendingAny = slices.some((s) => s.supplyPending);

  if (listLoading && !list?.length) {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2 sm:flex">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-1 items-center gap-2 rounded-xl border border-ink-100 px-2.5 py-2">
              <Skel className="h-6 w-6 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skel className="h-3 w-14" />
                <Skel className="h-2.5 w-20" />
              </div>
            </div>
          ))}
        </div>
        <div className="card p-2 space-y-2">
          {Array.from({ length: 8 }, (_, i) => (
            <Skel key={i} className="h-4 w-full" />
          ))}
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {["Price", "Market Cap", "24H Volume", "Transfers"].map((t) => (
            <ChartSkel key={t} title={t} kind="area" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Selection */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {items.map((t, i) => (
          <div key={t.address} className="flex min-w-0 items-center gap-2 sm:flex-1">
            {i > 0 && (
              <div className="hidden h-7 w-7 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-50 text-[9px] font-bold text-ink-500 sm:grid">
                VS
              </div>
            )}
            <div
              className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border bg-white px-2.5 py-2"
              style={{ borderColor: `${COLORS[i % COLORS.length]}66` }}
            >
              <TokenIcon address={t.address} src={t.iconUrl} symbol={t.symbol} size={22} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-ink-900">{t.symbol}</div>
                <div className="truncate text-[10px] text-ink-400">{t.name}</div>
              </div>
              {slices[i]?.anyPending && (
                <Skel className="h-2.5 w-2.5 rounded-full" />
              )}
              <button
                type="button"
                onClick={() => remove(t.address)}
                className="text-[12px] text-ink-400 hover:text-ink-700"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {items.length < MAX && (
          <div className="relative min-w-0 sm:min-w-[120px] sm:flex-1">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-ink-300 bg-white px-2.5 py-2 text-left"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-50 text-ink-500">
                +
              </span>
              <span>
                <span className="block text-[12px] font-medium text-ink-700">Add Token</span>
                <span className="text-[10px] text-ink-400">Up to {MAX}</span>
              </span>
            </button>
            {pickerOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-ink-200 bg-white shadow-lg">
                {available.slice(0, 50).map((t) => (
                  <button
                    key={t.address}
                    type="button"
                    onClick={() => add(t.address)}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[11px] hover:bg-ink-50"
                  >
                    <TokenIcon address={t.address} src={t.iconUrl} symbol={t.symbol} size={16} />
                    <span className="font-medium text-ink-800">{t.symbol}</span>
                    <span className="truncate text-ink-400">{t.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overview + Quick Take */}
      <div className="grid items-start gap-2 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="card overflow-hidden">
          <div className="border-b border-ink-100 px-2 py-1.5 text-[11px] font-semibold text-ink-800">
            Overview
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                  <th className="px-2 py-1.5 font-medium">Metric</th>
                  {items.map((t, i) => (
                    <th key={t.address} className="px-2 py-1.5 font-medium">
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                        {t.symbol}
                        {slices[i]?.anyPending && (
                          <Skel className="h-2 w-2 rounded-full" />
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overviewRows.map((r, ri) => (
                  <tr
                    key={r.label}
                    className={`border-b border-ink-50 ${ri % 2 ? "bg-ink-50/40" : ""}`}
                  >
                    <td className="px-2 py-1.5 text-ink-500">{r.label}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className="px-2 py-1.5 font-medium text-ink-800">
                        {r.pending[i] ? (
                          <Skel className="h-3 w-12" />
                        ) : (
                          <>
                            {r.format(v)}
                            {"changes" in r && r.changes?.[i] != null && (
                              <span
                                className={`ml-1 text-[10px] ${
                                  (r.changes[i] ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                                }`}
                              >
                                {pct(r.changes[i] ?? 0)}
                              </span>
                            )}
                          </>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card p-2">
          <div className="panel-title mb-1.5">Quick Take</div>
          <p className="text-[11px] leading-snug text-ink-600">{quickTake}</p>
          <div className="mt-2 space-y-1 text-[10px] text-ink-500">
            {items.map((t, i) => (
              <div key={t.address} className="flex items-center gap-1.5">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: RANK_DOTS[i % RANK_DOTS.length] }}
                />
                {i === 0 ? "Highest" : i === 1 ? "Second" : i === 2 ? "Third" : `#${i + 1}`} ·{" "}
                {t.symbol}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts 2x2 — each unlocks when its own series arrives */}
      <div className="grid gap-2 md:grid-cols-2">
        <MiniLine
          title="Price"
          format={usd}
          loading={pricePending && !priceReady}
          series={chartSeries.map((s) => ({ label: s.label, color: s.color, data: s.price }))}
        />
        <MiniLine
          title="Market Cap"
          format={usd}
          loading={mcapPending && !mcapReady}
          series={chartSeries.map((s) => ({ label: s.label, color: s.color, data: s.mcap }))}
        />
        <MiniLine
          title="24H Volume"
          format={usd}
          loading={volPending && !volReady}
          series={chartSeries.map((s) => ({ label: s.label, color: s.color, data: s.vol }))}
        />
        <MiniLine
          title="Transfers (24H)"
          loading={transfersPending && !transfersReady}
          series={chartSeries.map((s) => ({
            label: s.label,
            color: s.color,
            data: s.transfers,
          }))}
        />
      </div>

      <div className="grid gap-2 lg:grid-cols-4">
        <div className="card p-2 lg:col-span-1">
          <div className="panel-title mb-1.5">Supply & Distribution</div>
          {!supplyReady && supplyPendingAny ? (
            <div className="space-y-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skel key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[10px] text-ink-400">
                  <th className="py-1 text-left font-medium">Metric</th>
                  {items.map((t) => (
                    <th key={t.address} className="py-1 text-right font-medium">
                      {t.symbol}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplyRows.map((r) => (
                  <tr key={r.label} className="border-t border-ink-50">
                    <td className="py-1 text-ink-500">{r.label}</td>
                    {r.values.map((v, i) => (
                      <td key={i} className="py-1 text-right font-medium text-ink-800">
                        {v.pending ? <Skel className="ml-auto h-3 w-10" /> : v.text}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card p-2">
          <div className="panel-title mb-1">Top 10 Holders Share</div>
          {!holdersReady && holdersPending ? (
            <div className="flex items-center gap-3 py-2">
              <Skel className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skel className="h-3 w-full" />
                <Skel className="h-3 w-4/5" />
              </div>
            </div>
          ) : (
            <DonutChart title="Holders" slices={top10Shares} colors={COLORS} bare />
          )}
        </div>

        <div className="card p-2">
          <div className="panel-title mb-1.5">Performance (30D)</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[10px] text-ink-400">
                <th className="py-1 text-left font-medium">Metric</th>
                {items.map((t) => (
                  <th key={t.address} className="py-1 text-right font-medium">
                    {t.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {perfRows.map((r) => (
                <tr key={r.label} className="border-t border-ink-50">
                  <td className="py-1 text-ink-500">{r.label}</td>
                  {r.values.map((v, i) => (
                    <td
                      key={i}
                      className={`py-1 text-right font-medium ${
                        (v ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {v == null ? "—" : pct(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {items.map((t, i) => (
              <div key={t.address} className="text-center">
                {slices[i]?.countsPending && !slices[i]?.row.holders ? (
                  <Skel className="mx-auto h-10 w-10 rounded-full" />
                ) : (
                  <div
                    className="mx-auto grid h-10 w-10 place-items-center rounded-full text-[12px] font-semibold text-white"
                    style={{ background: COLORS[i % COLORS.length] }}
                  >
                    {scores[i]}
                  </div>
                )}
                <div className="mt-0.5 text-[9px] text-ink-400">{t.symbol}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-2">
          <div className="panel-title mb-1.5">Liquidity</div>
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-[10px] text-ink-400">
                <th className="py-1 text-left font-medium">Metric</th>
                {items.map((t) => (
                  <th key={t.address} className="py-1 text-right font-medium">
                    {t.symbol}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {liquidityRows.map((r) => (
                <tr key={r.label} className="border-t border-ink-50">
                  <td className="py-1 text-ink-500">{r.label}</td>
                  {r.values.map((v, i) => (
                    <td key={i} className="py-1 text-right font-medium text-ink-800">
                      {v.pending ? <Skel className="ml-auto h-3 w-10" /> : v.text}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <Link
            to={paths.tokens}
            className="mt-2 inline-block text-[10px] font-medium text-arc-600"
          >
            View Liquidity Pools →
          </Link>
        </div>
      </div>

      <div className="grid items-start gap-2 xl:grid-cols-[minmax(0,1.6fr)_minmax(240px,1fr)]">
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-1 border-b border-ink-100 px-2 py-1.5">
            <div className="panel-title">Recent Activity</div>
            <div className="flex gap-0.5">
              {(["All", "Transfers", "Swaps", "Mints", "Burns"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActivityTab(t)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    activityTab === t ? "bg-violet-50 text-violet-700" : "text-ink-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          {!activityReady && activityPending ? (
            <div className="space-y-2 p-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skel key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-[11px]">
                <thead>
                  <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                    <th className="px-2 py-1.5 font-medium">Time</th>
                    <th className="px-2 py-1.5 font-medium">Token</th>
                    <th className="px-2 py-1.5 font-medium">Type</th>
                    <th className="px-2 py-1.5 font-medium">From</th>
                    <th className="px-2 py-1.5 font-medium">To</th>
                    <th className="px-2 py-1.5 text-right font-medium">Amount</th>
                    <th className="px-2 py-1.5 text-right font-medium">Value</th>
                    <th className="px-2 py-1.5 font-medium">Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {activity.map((r, i) => (
                    <tr key={`${r.hash}-${i}`} className="border-b border-ink-50 hover:bg-ink-50/50">
                      <td className="px-2 py-1.5 text-ink-500">{r.time}</td>
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center gap-1 font-medium text-ink-800">
                          <TokenIcon
                            address={r.address}
                            src={r.iconUrl}
                            symbol={r.token}
                            size={14}
                          />
                          {r.token}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${
                            r.type === "Transfer"
                              ? "bg-emerald-50 text-emerald-700"
                              : r.type === "Swap"
                                ? "bg-violet-50 text-violet-700"
                                : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {r.type}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-ink-500">
                        {r.from ? shortHash(r.from) : "—"}
                      </td>
                      <td className="px-2 py-1.5 font-mono text-[10px] text-ink-500">
                        {r.to ? shortHash(r.to) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right font-medium">{r.amount}</td>
                      <td className="px-2 py-1.5 text-right text-ink-600">{r.value}</td>
                      <td className="px-2 py-1.5">
                        {r.hash ? (
                          <a
                            href={`https://testnet.arcscan.app/tx/${r.hash}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-[10px] text-arc-600"
                          >
                            {shortHash(r.hash)}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {!activity.length && (
                    <tr>
                      <td colSpan={8} className="px-2 py-4 text-center text-ink-400">
                        No recent transfers
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-2">
          <div className="panel-title mb-1.5">Correlation (30D)</div>
          {!priceReady && pricePending ? (
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 9 }, (_, i) => (
                <Skel key={i} className="aspect-square rounded" />
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              <div
                className="grid min-w-0 flex-1 gap-1"
                style={{
                  gridTemplateColumns: `32px repeat(${Math.max(items.length, 1)}, minmax(0, 1fr))`,
                }}
              >
                <div />
                {items.map((t) => (
                  <div
                    key={`h-${t.address}`}
                    className="text-center text-[9px] font-medium text-ink-500"
                  >
                    {t.symbol}
                  </div>
                ))}
                {items.map((row, i) => (
                  <div key={row.address} className="contents">
                    <div className="flex items-center text-[9px] font-medium text-ink-500">
                      {row.symbol}
                    </div>
                    {items.map((col, j) => {
                      const v = corr[i]?.[j] ?? 0;
                      return (
                        <div
                          key={`${row.address}-${col.address}`}
                          className="grid aspect-square place-items-center rounded text-[9px] font-semibold text-white"
                          style={{ background: corrColor(v) }}
                          title={`${row.symbol} vs ${col.symbol}: ${v.toFixed(2)}`}
                        >
                          {v.toFixed(2)}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center justify-between py-4 text-[8px] text-ink-400">
                <span>1</span>
                <div
                  className="my-1 w-2 flex-1 rounded-full"
                  style={{ background: "linear-gradient(#22c55e, #c4b5fd, #7c3aed)" }}
                />
                <span>-1</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
