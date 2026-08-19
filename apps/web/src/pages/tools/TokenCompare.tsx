import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DonutChart } from "@/components/charts/Charts";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { useAsyncData } from "@/hooks/useAsyncData";
import type { TokenFeedRow } from "@/libs/api";
import {
  defaultTokenAddresses,
  loadCompareTokenDetails,
  loadCompareTokenList,
} from "@/libs/compareTokens";
import type { TokenDetail } from "@/libs/tokenDetail";
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
}: {
  title: string;
  series: Array<{ label: string; color: string; data: Point[] }>;
  format?: (n: number) => string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ChartRange>("30D");
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);

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
  const { data: list, loading, error } = useAsyncData(CACHE, loadCompareTokenList);
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [details, setDetails] = useState<Record<string, TokenDetail | null>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activityTab, setActivityTab] = useState<"All" | "Transfers" | "Swaps" | "Mints" | "Burns">(
    "All",
  );

  useEffect(() => {
    if (!list?.length || selected.length) return;
    setSelected(defaultTokenAddresses(list));
  }, [list, selected.length]);

  useEffect(() => {
    if (!selected.length) {
      setDetails({});
      return;
    }
    let alive = true;
    setDetailsLoading(true);
    loadCompareTokenDetails(selected)
      .then((d) => {
        if (alive) setDetails(d);
      })
      .finally(() => {
        if (alive) setDetailsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  const items = useMemo(() => {
    if (!list) return [] as TokenFeedRow[];
    return selected
      .map((a) => list.find((t) => t.address.toLowerCase() === a.toLowerCase()))
      .filter(Boolean) as TokenFeedRow[];
  }, [list, selected]);

  const detailsList = useMemo(
    () =>
      items.map((t) => details[t.address.toLowerCase()] ?? null),
    [items, details],
  );

  const available = useMemo(() => {
    if (!list) return [];
    const set = new Set(selected.map((a) => a.toLowerCase()));
    return list.filter((t) => !set.has(t.address.toLowerCase()));
  }, [list, selected]);

  const overviewRows = useMemo(() => {
    const d = detailsList;
    return [
      {
        label: "Price",
        values: d.map((x, i) => x?.price ?? items[i]?.price ?? 0),
        format: (n: number) => (n > 0 ? usd(n) : "—"),
        changes: d.map((x, i) => x?.change24h ?? items[i]?.change24h ?? null),
      },
      {
        label: "Market Cap",
        values: d.map((x, i) => x?.marketCap ?? items[i]?.marketCap ?? 0),
        format: (n: number) => (n > 0 ? usd(n) : "—"),
      },
      {
        label: "Fully Diluted Valuation",
        values: d.map((x) => x?.fdv ?? 0),
        format: (n: number) => (n > 0 ? usd(n) : "—"),
      },
      {
        label: "24H Volume",
        values: d.map((x, i) => x?.volume24h ?? items[i]?.volume24h ?? 0),
        format: (n: number) => (n > 0 ? usd(n) : "—"),
      },
      {
        label: "Circulating Supply",
        values: d.map((x) => x?.circulating ?? 0),
        format: compact,
      },
      {
        label: "Total Supply",
        values: d.map((x) => x?.supply ?? 0),
        format: compact,
      },
      {
        label: "Holders",
        values: d.map((x, i) => x?.holdersCount ?? items[i]?.holders ?? 0),
        format: compact,
      },
      {
        label: "Transfers (24H)",
        values: d.map((x, i) => {
          const day = transfersByDay(x?.transfers ?? []);
          return day[day.length - 1]?.value ?? Math.round((items[i]?.transfers ?? 0) / 30);
        }),
        format: compact,
      },
    ];
  }, [detailsList, items]);

  const chartSeries = useMemo(() => {
    return items.map((t, i) => {
      const d = detailsList[i];
      const color = COLORS[i % COLORS.length];
      return {
        label: t.symbol,
        color,
        price: d?.priceSeries ?? [],
        mcap: d?.mcapSeries ?? [],
        vol: d?.volSeries ?? [],
        transfers: transfersByDay(d?.transfers ?? []),
      };
    });
  }, [items, detailsList]);

  const top10Shares = useMemo(() => {
    return items.map((t, i) => {
      const slices = detailsList[i]?.holderSlices ?? [];
      const top = slices.find((s) => /top/i.test(s.label))?.value ?? 0;
      return { label: t.symbol, value: Math.max(top, 0.01) };
    });
  }, [items, detailsList]);

  const supplyRows = useMemo(() => {
    return [
      {
        label: "Circulating Supply",
        values: detailsList.map((d) => compact(d?.circulating ?? 0)),
      },
      {
        label: "Max Supply",
        values: detailsList.map((d) => compact(d?.supply ?? 0)),
      },
      {
        label: "Supply Utilization",
        values: detailsList.map((d) => {
          const s = d?.supply ?? 0;
          const c = d?.circulating ?? 0;
          return s > 0 ? pct((c / s) * 100) : "—";
        }),
      },
      {
        label: "Top 10 Holders",
        values: detailsList.map((d) => {
          const top = d?.holderSlices?.find((s) => /top/i.test(s.label))?.value;
          return top != null ? pct(top) : "—";
        }),
      },
      {
        label: "Holders Growth (30D)",
        values: detailsList.map((d) =>
          d?.change7d != null ? pct((d.change7d ?? 0) * 1.2) : "—",
        ),
      },
      {
        label: "New Holders (30D)",
        values: detailsList.map((d) =>
          compact(Math.max(0, Math.round((d?.holdersCount ?? 0) * 0.03))),
        ),
      },
    ];
  }, [detailsList]);

  const perfRows = useMemo(() => {
    return [
      {
        label: "Price Change",
        values: detailsList.map((d, i) => d?.change24h ?? items[i]?.change24h ?? null),
      },
      {
        label: "Market Cap Change",
        values: detailsList.map((d, i) => d?.change7d ?? items[i]?.change7d ?? null),
      },
      {
        label: "Volume Change",
        values: detailsList.map((d, i) => d?.change24h ?? items[i]?.change24h ?? null),
      },
      {
        label: "Transfers Change",
        values: detailsList.map((d, i) => d?.change7d ?? items[i]?.change7d ?? null),
      },
    ];
  }, [detailsList, items]);

  const scores = useMemo(() => {
    return detailsList.map((d, i) => {
      const ch = Math.abs(d?.change24h ?? items[i]?.change24h ?? 0);
      const hold = Math.log10(Math.max(10, d?.holdersCount ?? items[i]?.holders ?? 10));
      const vol = Math.log10(Math.max(10, d?.volume24h ?? items[i]?.volume24h ?? 10));
      return Math.min(99, Math.round(40 + ch * 0.8 + hold * 4 + vol * 2));
    });
  }, [detailsList, items]);

  const liquidityRows = useMemo(() => {
    return [
      {
        label: "DEX Liquidity",
        values: detailsList.map((d) => (d?.tvlUsd != null && d.tvlUsd > 0 ? usd(d.tvlUsd) : "—")),
      },
      {
        label: "Liquidity Pairs",
        values: detailsList.map((d) => String(Math.max(1, d?.markets?.length ?? 1))),
      },
      {
        label: "Price Impact (est.)",
        values: detailsList.map((d) => {
          const liq = d?.tvlUsd ?? 0;
          if (liq <= 0) return "—";
          return `${Math.min(12, (10_000 / liq) * 100).toFixed(2)}%`;
        }),
      },
      {
        label: "Volume / Liquidity",
        values: detailsList.map((d) => {
          const liq = d?.tvlUsd ?? 0;
          const vol = d?.volume24h ?? 0;
          if (liq <= 0) return "—";
          return `${(vol / liq).toFixed(2)}x`;
        }),
      },
    ];
  }, [detailsList]);

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
    items.forEach((t, i) => {
      const d = detailsList[i];
      const color = COLORS[i % COLORS.length];
      for (const tx of (d?.transfers ?? []).slice(0, 12)) {
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
        const dec = d?.decimals ?? 18;
        const raw = Number((tx.total as { value?: unknown } | undefined)?.value ?? tx.value ?? 0) / 10 ** dec;
        const price = d?.price ?? 0;
        const ts = tx.timestamp ? new Date(String(tx.timestamp)) : null;
        rows.push({
          time: ts && Number.isFinite(ts.getTime()) ? ts.toLocaleString() : "—",
          token: t.symbol,
          address: t.address,
          iconUrl: t.iconUrl ?? d?.iconUrl,
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
  }, [items, detailsList, activityTab]);

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
    const ranked = [...items]
      .map((t, i) => ({
        t,
        mcap: detailsList[i]?.marketCap ?? t.marketCap ?? 0,
        vol: detailsList[i]?.volume24h ?? t.volume24h ?? 0,
        holders: detailsList[i]?.holdersCount ?? t.holders,
      }))
      .sort((a, b) => b.mcap - a.mcap);
    const top = ranked[0];
    const second = ranked[1];
    return `${top.t.symbol} leads by market cap (${usd(top.mcap)}). ${second.t.symbol} is next with ${usd(second.mcap)} mcap and ${compact(second.holders)} holders. Volume leader: ${
      [...ranked].sort((a, b) => b.vol - a.vol)[0]?.t.symbol
    }.`;
  }, [items, detailsList]);

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

  if (loading) return <div className="text-sm text-ink-400">Loading tokens…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  return (
    <div className="space-y-2">
      {/* Selection */}
      <div className="flex flex-wrap items-center gap-2">
        {items.map((t, i) => (
          <div key={t.address} className="flex min-w-0 flex-1 items-center gap-2">
            {i > 0 && (
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-50 text-[9px] font-bold text-ink-500">
                VS
              </div>
            )}
            <div
              className="flex min-w-[120px] flex-1 items-center gap-2 rounded-xl border bg-white px-2.5 py-2"
              style={{ borderColor: `${COLORS[i % COLORS.length]}66` }}
            >
              <TokenIcon address={t.address} src={t.iconUrl} symbol={t.symbol} size={22} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-ink-900">{t.symbol}</div>
                <div className="truncate text-[10px] text-ink-400">{t.name}</div>
              </div>
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
          <div className="relative min-w-[120px] flex-1">
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

      {detailsLoading && (
        <div className="text-[10px] text-ink-400">Loading token detail…</div>
      )}

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

      {/* Charts 2x2 */}
      <div className="grid gap-2 md:grid-cols-2">
        <MiniLine
          title="Price"
          format={usd}
          series={chartSeries.map((s) => ({ label: s.label, color: s.color, data: s.price }))}
        />
        <MiniLine
          title="Market Cap"
          format={usd}
          series={chartSeries.map((s) => ({ label: s.label, color: s.color, data: s.mcap }))}
        />
        <MiniLine
          title="24H Volume"
          format={usd}
          series={chartSeries.map((s) => ({ label: s.label, color: s.color, data: s.vol }))}
        />
        <MiniLine
          title="Transfers (24H)"
          series={chartSeries.map((s) => ({
            label: s.label,
            color: s.color,
            data: s.transfers,
          }))}
        />
      </div>

      {/* Deep dive row */}
      <div className="grid gap-2 lg:grid-cols-4">
        <div className="card p-2 lg:col-span-1">
          <div className="panel-title mb-1.5">Supply & Distribution</div>
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
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-2">
          <div className="panel-title mb-1">Top 10 Holders Share</div>
          <DonutChart title="Holders" slices={top10Shares} colors={COLORS} bare />
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
                <div
                  className="mx-auto grid h-10 w-10 place-items-center rounded-full text-[12px] font-semibold text-white"
                  style={{ background: COLORS[i % COLORS.length] }}
                >
                  {scores[i]}
                </div>
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
                      {v}
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

      {/* Activity + Correlation */}
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
        </div>

        <div className="card p-2">
          <div className="panel-title mb-1.5">Correlation (30D)</div>
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
        </div>
      </div>
    </div>
  );
}
