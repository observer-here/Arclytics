import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { DonutChart } from "@/components/charts/Charts";
import { Icons } from "@/components/shared/Icons";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { ADDR_RE } from "@/config/wallets";
import { useAsyncData } from "@/hooks/useAsyncData";
import type { AddressDetail } from "@/libs/addressDetail";
import {
  defaultWalletAddresses,
  loadCompareWalletDetails,
  loadCompareWalletList,
  protocolFor,
} from "@/libs/compareWallets";
import type { WalletRow } from "@/libs/wallets";
import { paths } from "@/routes/paths";
import { compact, pct, shortHash, usd } from "@/utils/format";

const CACHE = "compare-wallets-v1";
const COLORS = ["#8b5cf6", "#3b82f6", "#06b6d4", "#f59e0b"];
const DONUT = ["#8b5cf6", "#3b82f6", "#10b981", "#f97316", "#94a3b8"];
const MAX = 4;
const CHART_RANGES = ["7D", "30D", "90D", "1Y"] as const;
const SUBS = [
  "Portfolio",
  "Activity",
  "Transactions",
  "Tokens",
  "NFTs",
  "Protocols",
  "DeFi Positions",
  "PnL Analysis",
  "Gas & Fees",
] as const;

type ChartRange = (typeof CHART_RANGES)[number];
type Sub = (typeof SUBS)[number];
type Point = { date: string; value: number };

function slicePts(data: Point[], range: ChartRange) {
  const n = range === "7D" ? 7 : range === "30D" ? 30 : range === "90D" ? 90 : 365;
  return data.slice(-Math.min(n, data.length));
}

function letter(addr: string) {
  return addr.slice(2, 4).toUpperCase();
}

function daysOf(d: AddressDetail) {
  return new Set(d.txs.map((t) => t.timestamp?.slice(0, 10)).filter(Boolean)).size;
}

function flow(d: AddressDetail) {
  let inflow = 0;
  let outflow = 0;
  let fees = 0;
  let ok = 0;
  for (const t of d.txs) {
    if (t.direction === "in") inflow += t.valueUsdc;
    if (t.direction === "out") outflow += t.valueUsdc;
    fees += t.feeUsdc;
    if (t.ok !== false) ok += 1;
  }
  const n = d.txs.length || 1;
  return {
    inflow,
    outflow,
    net: inflow - outflow,
    fees,
    avg: (inflow + outflow) / n,
    success: (ok / n) * 100,
  };
}

function pnl(d: AddressDetail, row?: WalletRow) {
  const s = d.balanceSeries;
  if (s.length >= 2) {
    const a = s[0].value;
    const b = s[s.length - 1].value;
    return { usd: b - a, pct: a > 0 ? ((b - a) / a) * 100 : 0 };
  }
  const ch = row?.change7d ?? row?.change24h;
  if (ch != null) return { usd: (d.netWorth * ch) / 100, pct: ch };
  return { usd: 0, pct: 0 };
}

function slices(d: AddressDetail) {
  const native = { label: "USDC", value: d.nativeUsdc };
  const top = d.tokens.slice(0, 4).map((t) => ({ label: t.symbol || "Token", value: t.valueUsd }));
  const used = new Set(top.map((t) => t.label));
  const rest = d.tokens
    .filter((t) => !used.has(t.symbol))
    .reduce((s, t) => s + t.valueUsd, 0);
  const out = [native, ...top];
  if (rest > 0) out.push({ label: "Other", value: rest });
  return out.filter((s) => s.value > 0);
}

function MiniLine({
  title,
  series,
}: {
  title: string;
  series: Array<{ label: string; color: string; data: Point[] }>;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<ChartRange>("30D");
  const [tip, setTip] = useState<{ i: number; x: number; y: number } | null>(null);
  const sliced = series.map((s) => ({ ...s, data: slicePts(s.data, range) }));
  const dates = [...new Set(sliced.flatMap((s) => s.data.map((d) => d.date)))].sort();
  const aligned = sliced.map((s) => {
    const map = new Map(s.data.map((d) => [d.date, d.value]));
    return { ...s, data: dates.map((date) => ({ date, value: map.get(date) ?? 0 })) };
  });
  const max = Math.max(...aligned.flatMap((s) => s.data.map((d) => d.value)), 1);
  const w = 420;
  const h = 130;
  const padL = 42;
  const padR = 8;
  const padT = 8;
  const padB = 16;
  const iw = w - padL - padR;
  const ih = h - padT - padB;
  const n = Math.max(dates.length - 1, 1);

  const showAt = (i: number, cx: number, cy: number) => {
    const el = box.current;
    if (!el || !dates[i]) return;
    const r = el.getBoundingClientRect();
    setTip({ i, x: Math.min(r.width - 8, Math.max(8, cx - r.left)), y: Math.max(12, cy - r.top - 4) });
  };

  return (
    <div ref={box} className="card relative h-full p-2" onMouseLeave={() => setTip(null)}>
      <div className="mb-1 flex items-center justify-between gap-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="panel-title">{title}</div>
          <div className="hidden gap-1.5 sm:flex">
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
              {s.label}
              <span className="ml-auto font-medium">{usd(s.data[tip.i]?.value ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
      {dates.length < 2 ? (
        <div className="flex h-[110px] items-center justify-center text-[11px] text-ink-400">No series</div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="h-[118px] w-full overflow-visible" preserveAspectRatio="none">
          {[0, 0.5, 1].map((t) => {
            const y = padT + ih - t * ih;
            return (
              <g key={t}>
                <line x1={padL} x2={w - padR} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
                <text x={padL - 4} y={y + 3} textAnchor="end" className="fill-ink-400" fontSize="8">
                  {usd(max * t)}
                </text>
              </g>
            );
          })}
          {aligned.map((s) => (
            <polyline
              key={s.label}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              points={s.data
                .map((d, i) => `${padL + (i / n) * iw},${padT + ih - (d.value / max) * ih}`)
                .join(" ")}
            />
          ))}
          {[0, Math.floor(dates.length / 2), dates.length - 1].map((i) =>
            dates[i] ? (
              <text
                key={i}
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
          {dates.map((d, i) => (
            <rect
              key={d}
              x={Math.max(padL, padL + ((i - 0.5) / n) * iw)}
              y={padT}
              width={Math.max(4, iw / n)}
              height={ih}
              fill="transparent"
              className="cursor-crosshair"
              onMouseEnter={(e) => showAt(i, e.clientX, e.clientY)}
              onMouseMove={(e) => showAt(i, e.clientX, e.clientY)}
            />
          ))}
        </svg>
      )}
    </div>
  );
}

export function WalletCompare() {
  const { data, loading, error } = useAsyncData(CACHE, loadCompareWalletList);
  const [selected, setSelected] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [details, setDetails] = useState<Record<string, AddressDetail | null>>({});
  const [busy, setBusy] = useState(false);
  const [sub, setSub] = useState<Sub>("Portfolio");

  useEffect(() => {
    if (!data?.wallets.length || selected.length) return;
    setSelected(defaultWalletAddresses(data.wallets));
  }, [data, selected.length]);

  useEffect(() => {
    if (!selected.length) {
      setDetails({});
      return;
    }
    let alive = true;
    setBusy(true);
    loadCompareWalletDetails(selected)
      .then((d) => {
        if (alive) setDetails(d);
      })
      .finally(() => {
        if (alive) setBusy(false);
      });
    return () => {
      alive = false;
    };
  }, [selected]);

  const list = data?.wallets ?? [];
  const rankings = data?.rankings ?? [];

  const items = useMemo(() => {
    return selected.map((a, i) => {
      const addr = a.toLowerCase();
      const row = list.find((w) => w.address.toLowerCase() === addr);
      const d = details[addr];
      return {
        address: addr,
        label: row?.name || row?.label || `Wallet ${String.fromCharCode(65 + i)}`,
        row,
        d,
        color: COLORS[i % COLORS.length],
      };
    });
  }, [selected, list, details]);

  const ready = items.filter((w) => w.d);

  const available = useMemo(() => {
    const set = new Set(selected.map((a) => a.toLowerCase()));
    const q = query.trim().toLowerCase();
    return list.filter((w) => {
      if (set.has(w.address.toLowerCase())) return false;
      if (!q) return true;
      return w.address.toLowerCase().includes(q) || (w.label ?? "").toLowerCase().includes(q);
    });
  }, [list, selected, query]);

  const stats = useMemo(
    () =>
      items.map((w) => {
        if (!w.d) return null;
        const f = flow(w.d);
        const p = pnl(w.d, w.row);
        return { ...f, pnl: p, days: daysOf(w.d), txs: w.d.txCount || w.d.txs.length };
      }),
    [items],
  );

  const protocols = useMemo(() => {
    const map = new Map<string, { name: string; slug: string; txs: number[]; vol: number[] }>();
    items.forEach((w, i) => {
      for (const tx of w.d?.txs ?? []) {
        const p = protocolFor(tx.to, rankings) ?? protocolFor(tx.from, rankings);
        if (!p) continue;
        const cur = map.get(p.slug) ?? {
          name: p.name,
          slug: p.slug,
          txs: items.map(() => 0),
          vol: items.map(() => 0),
        };
        cur.txs[i] += 1;
        cur.vol[i] += tx.valueUsdc;
        map.set(p.slug, cur);
      }
    });
    return [...map.values()].sort((a, b) => b.vol.reduce((s, n) => s + n, 0) - a.vol.reduce((s, n) => s + n, 0)).slice(0, 8);
  }, [items, rankings]);

  const insights = useMemo(() => {
    if (ready.length < 2 || !ready[0].d || !ready[1].d) return [];
    const a = ready[0].d;
    const b = ready[1].d;
    const out: string[] = [];
    if (b.netWorth > 0) {
      const g = ((a.netWorth - b.netWorth) / b.netWorth) * 100;
      out.push(
        g >= 0
          ? `${shortHash(a.address)} has ${pct(g)} higher portfolio value than ${shortHash(b.address)}.`
          : `${shortHash(b.address)} has ${pct(-g)} higher portfolio value than ${shortHash(a.address)}.`,
      );
    }
    out.push(
      a.txCount >= b.txCount
        ? `${shortHash(a.address)} is more active (${compact(a.txCount)} txs).`
        : `${shortHash(b.address)} is more active (${compact(b.txCount)} txs).`,
    );
    out.push(
      a.nftCount >= b.nftCount
        ? `${shortHash(a.address)} holds more NFTs (${a.nftCount}).`
        : `${shortHash(b.address)} holds more NFTs (${b.nftCount}).`,
    );
    const fa = flow(a);
    const fb = flow(b);
    out.push(
      fa.fees >= fb.fees
        ? `${shortHash(a.address)} spent more gas (${usd(fa.fees)}).`
        : `${shortHash(b.address)} spent more gas (${usd(fb.fees)}).`,
    );
    return out;
  }, [ready]);

  const activity = useMemo(() => {
    const rows = items.flatMap((w, i) =>
      (w.d?.txs ?? []).map((t) => ({
        ...t,
        token: "USDC",
        color: COLORS[i % COLORS.length],
        wallet: shortHash(w.address),
      })),
    );
    rows.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    return rows.slice(0, 16);
  }, [items]);

  const add = (addr: string) => {
    const a = addr.toLowerCase();
    if (!ADDR_RE.test(a) || selected.length >= MAX || selected.some((x) => x.toLowerCase() === a)) return;
    setSelected((s) => [...s, a]);
    setPickerOpen(false);
    setQuery("");
  };

  if (loading) return <div className="text-sm text-ink-400">Loading wallets…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  const pack = [
    { label: "Total Inflow (30D)", icon: <Icons.Volume size={12} />, color: "#10b981", key: "inflow" as const, fmt: usd },
    { label: "Total Outflow (30D)", icon: <Icons.Tx size={12} />, color: "#f43f5e", key: "outflow" as const, fmt: usd },
    { label: "Net Flow (30D)", icon: <Icons.Activity size={12} />, color: "#8b5cf6", key: "net" as const, fmt: usd },
    { label: "Gas Spent (30D)", icon: <Icons.Gas size={12} />, color: "#f59e0b", key: "fees" as const, fmt: usd },
    { label: "Avg. Tx Value", icon: <Icons.Tvl size={12} />, color: "#3b82f6", key: "avg" as const, fmt: usd },
    { label: "Tx Success Rate", icon: <Icons.Verified size={12} />, color: "#06b6d4", key: "success" as const, fmt: (n: number) => `${n.toFixed(1)}%` },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {items.map((w, i) => (
          <div key={w.address} className="flex min-w-0 flex-1 items-center gap-2">
            {i > 0 && (
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-ink-200 bg-ink-50 text-[9px] font-bold text-ink-500">
                VS
              </div>
            )}
            <div
              className="flex min-w-[140px] flex-1 items-center gap-2 rounded-xl border bg-white px-2.5 py-2"
              style={{ borderColor: `${w.color}66` }}
            >
              <span
                className="grid h-7 w-7 place-items-center rounded-full text-[10px] font-semibold text-white"
                style={{ background: w.color }}
              >
                {letter(w.address)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-semibold text-ink-900">{w.label}</div>
                <Link to={paths.address(w.address)} className="font-mono text-[10px] text-ink-400">
                  {shortHash(w.address)}
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setSelected((s) => s.filter((x) => x.toLowerCase() !== w.address))}
                className="text-[12px] text-ink-400 hover:text-ink-700"
              >
                ×
              </button>
            </div>
          </div>
        ))}
        {items.length < MAX && (
          <div className="relative min-w-[140px] flex-1">
            <button
              type="button"
              onClick={() => setPickerOpen((o) => !o)}
              className="flex w-full items-center gap-2 rounded-xl border border-dashed border-ink-300 bg-white px-2.5 py-2 text-left"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-ink-50 text-ink-500">+</span>
              <span>
                <span className="block text-[12px] font-medium text-ink-700">Add Wallet</span>
                <span className="text-[10px] text-ink-400">Up to {MAX} wallets</span>
              </span>
            </button>
            {pickerOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-auto rounded-lg border border-ink-200 bg-white p-1 shadow-lg">
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Paste 0x… or search"
                  className="mb-1 w-full rounded border border-ink-200 px-2 py-1 text-[11px]"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") add(query.trim());
                  }}
                />
                {ADDR_RE.test(query.trim()) && (
                  <button
                    type="button"
                    onClick={() => add(query.trim())}
                    className="mb-1 w-full rounded bg-violet-50 px-2 py-1 text-left text-[11px] font-medium text-violet-700"
                  >
                    Compare {shortHash(query.trim())}
                  </button>
                )}
                {available.slice(0, 30).map((w) => (
                  <button
                    key={w.address}
                    type="button"
                    onClick={() => add(w.address)}
                    className="flex w-full items-center justify-between gap-2 px-2 py-1 text-left text-[11px] hover:bg-ink-50"
                  >
                    <span className="font-mono text-ink-800">{shortHash(w.address)}</span>
                    <span className="text-ink-400">{usd(w.netWorth)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {busy && <div className="text-[10px] text-ink-400">Loading wallet detail…</div>}

      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${Math.max(items.length + (items.length === 2 ? 1 : 0), 1)}, minmax(0,1fr))` }}
      >
        {items.map((w, i) => {
          const s = stats[i];
          return (
            <div key={w.address} className="card p-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-ink-800">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: w.color }} />
                {w.label}
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                <div>
                  <div className="text-[10px] text-ink-400">Portfolio Value</div>
                  <div className="font-semibold text-ink-900">{w.d ? usd(w.d.netWorth) : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-400">Total PnL</div>
                  <div className={`font-semibold ${(s?.pnl.pct ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {s ? `${usd(s.pnl.usd)} ${pct(s.pnl.pct)}` : "—"}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-400">Transactions</div>
                  <div className="font-semibold text-ink-900">{s ? compact(s.txs) : "—"}</div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-400">Active Days</div>
                  <div className="font-semibold text-ink-900">{s ? s.days : "—"}</div>
                </div>
              </div>
            </div>
          );
        })}
        {items.length === 2 && stats[0] && stats[1] && (
          <div className="card p-2">
            <div className="mb-1.5 text-[11px] font-semibold text-ink-800">Difference</div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {(
                [
                  ["Portfolio Value", (items[0].d?.netWorth ?? 0) - (items[1].d?.netWorth ?? 0), usd],
                  ["Total PnL", stats[0].pnl.usd - stats[1].pnl.usd, usd],
                  ["Transactions", stats[0].txs - stats[1].txs, compact],
                  ["Active Days", stats[0].days - stats[1].days, (n: number) => String(n)],
                ] as const
              ).map(([label, v, fmt]) => (
                <div key={label}>
                  <div className="text-[10px] text-ink-400">{label}</div>
                  <div className={`font-semibold ${v >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                    {v >= 0 ? "↑ " : "↓ "}
                    {fmt(Math.abs(v))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-ink-100 pb-1">
        {SUBS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setSub(t)}
            className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium ${
              sub === t ? "bg-violet-600 text-white" : "text-ink-500 hover:bg-ink-50"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {(sub === "Portfolio" || sub === "PnL Analysis") && (
        <div className="grid items-stretch gap-2 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <MiniLine
            title="Portfolio Value Over Time"
            series={items.map((w) => ({
              label: shortHash(w.address),
              color: w.color,
              data: w.d?.balanceSeries ?? [],
            }))}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((w) => (
              <div key={w.address} className="card p-2">
                <div className="panel-title mb-1">Asset Distribution</div>
                <DonutChart title="Assets" slices={w.d ? slices(w.d) : []} colors={DONUT} bare />
              </div>
            ))}
          </div>
        </div>
      )}

      {(sub === "Portfolio" || sub === "Gas & Fees") && (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
          {pack.map((p) => (
            <div key={p.label} className="card p-2">
              <div
                className="mb-1 grid h-6 w-6 place-items-center rounded-md text-white"
                style={{ background: p.color }}
              >
                {p.icon}
              </div>
              <div className="text-[10px] text-ink-400">{p.label}</div>
              <div className="text-[13px] font-semibold text-ink-900">
                {(() => {
                  const live = stats.filter(Boolean);
                  const sum = live.reduce((s, x) => s + (x?.[p.key] ?? 0), 0);
                  const n = Math.max(live.length, 1);
                  return p.fmt(p.key === "avg" || p.key === "success" ? sum / n : sum);
                })()}
              </div>
              <div className="mt-1 space-y-0.5 text-[10px]">
                {items.map((w, i) => (
                  <div key={w.address} className="flex justify-between text-ink-500">
                    <span className="truncate">{shortHash(w.address)}</span>
                    <span className="font-medium text-ink-800">
                      {stats[i] ? p.fmt(stats[i]![p.key]) : "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === "Portfolio" && (
        <div className="grid items-start gap-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.15fr)_minmax(0,0.9fr)_200px]">
          <div className="card p-2">
            <div className="panel-title mb-1.5">Top Tokens by Value</div>
            <div className={`grid gap-2 ${items.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {items.map((w) => (
                <div key={w.address} className="space-y-1.5">
                  <div className="text-[10px] font-medium text-ink-400">{shortHash(w.address)}</div>
                  {(w.d?.tokens ?? []).slice(0, 5).map((t) => (
                    <div key={t.address} className="flex items-center gap-1.5 text-[11px]">
                      <TokenIcon address={t.address} src={t.iconUrl} symbol={t.symbol} size={14} />
                      <span className="min-w-0 flex-1 truncate font-medium text-ink-800">{t.symbol}</span>
                      <span className="text-right">
                        <span className="block font-medium">{usd(t.valueUsd)}</span>
                        <span className="text-[9px] text-ink-400">
                          {w.d && w.d.netWorth > 0 ? `${((t.valueUsd / w.d.netWorth) * 100).toFixed(1)}%` : "—"}
                        </span>
                      </span>
                    </div>
                  ))}
                  {!w.d?.tokens.length && <div className="text-[10px] text-ink-400">No tokens</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-ink-100 px-2 py-1.5 text-[11px] font-semibold">
              Protocol Interactions (30D)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                    <th className="px-2 py-1 text-left font-medium">Protocol</th>
                    {items.map((w) => (
                      <th key={w.address} className="px-2 py-1 text-right font-medium">
                        {shortHash(w.address)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {protocols.map((p) => (
                    <tr key={p.slug} className="border-b border-ink-50">
                      <td className="px-2 py-1">
                        <Link to={paths.protocol(p.slug)} className="inline-flex items-center gap-1 font-medium">
                          <ProtocolIcon slug={p.slug} name={p.name} size={14} />
                          {p.name}
                        </Link>
                      </td>
                      {p.txs.map((n, i) => (
                        <td key={i} className="px-2 py-1 text-right text-ink-600">
                          {n} · {usd(p.vol[i])}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!protocols.length && (
                    <tr>
                      <td colSpan={items.length + 1} className="px-2 py-3 text-center text-ink-400">
                        No matched protocol txs
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card p-2">
            <div className="panel-title mb-1.5">NFT Holdings</div>
            <div className={`grid gap-2 ${items.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {items.map((w) => (
                <div key={w.address} className="space-y-1.5">
                  <div className="text-[10px] font-medium text-ink-400">{shortHash(w.address)}</div>
                  {(w.d?.nfts ?? []).slice(0, 5).map((n) => (
                    <div key={n.address} className="flex items-center justify-between gap-1 text-[11px]">
                      <span className="truncate font-medium text-ink-800">{n.name || n.symbol || "NFT"}</span>
                      <span className="text-ink-500">×{n.count}</span>
                    </div>
                  ))}
                  {!w.d?.nfts.length && <div className="text-[10px] text-ink-400">No NFTs</div>}
                </div>
              ))}
            </div>
          </div>

          <div className="card p-2">
            <div className="panel-title mb-1.5">Insights</div>
            <ul className="space-y-1.5 text-[11px] leading-snug text-ink-600">
              {insights.map((t) => (
                <li key={t} className="border-l-2 border-violet-400 pl-1.5">
                  {t}
                </li>
              ))}
              {!insights.length && <li className="text-ink-400">Add two wallets to see insights.</li>}
            </ul>
          </div>
        </div>
      )}

      {(sub === "Activity" || sub === "Transactions") && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                  <th className="px-2 py-1.5 font-medium">Time</th>
                  <th className="px-2 py-1.5 font-medium">Wallet</th>
                  <th className="px-2 py-1.5 font-medium">Method</th>
                  <th className="px-2 py-1.5 font-medium">From</th>
                  <th className="px-2 py-1.5 font-medium">To</th>
                  <th className="px-2 py-1.5 text-right font-medium">Value</th>
                  <th className="px-2 py-1.5 font-medium">Tx</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((t, i) => (
                  <tr key={`${t.hash}-${i}`} className="border-b border-ink-50">
                    <td className="px-2 py-1.5 text-ink-500">
                      {t.timestamp ? new Date(t.timestamp).toLocaleString() : "—"}
                    </td>
                    <td className="px-2 py-1.5 font-medium" style={{ color: t.color }}>
                      {t.wallet}
                    </td>
                    <td className="px-2 py-1.5">{t.method}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{shortHash(t.from)}</td>
                    <td className="px-2 py-1.5 font-mono text-[10px]">{shortHash(t.to)}</td>
                    <td className="px-2 py-1.5 text-right">{usd(t.valueUsdc)}</td>
                    <td className="px-2 py-1.5">
                      <a
                        href={`https://testnet.arcscan.app/tx/${t.hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10px] text-arc-600"
                      >
                        {shortHash(t.hash)}
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(sub === "Tokens" || sub === "DeFi Positions") && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                  <th className="px-2 py-1.5 font-medium">Token</th>
                  {items.map((w) => (
                    <th key={w.address} className="px-2 py-1.5 text-right font-medium">
                      {shortHash(w.address)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ...new Map(
                    items.flatMap((w) => (w.d?.tokens ?? []).map((t) => [t.address, t] as const)),
                  ).values(),
                ]
                  .slice(0, 20)
                  .map((t) => (
                    <tr key={t.address} className="border-b border-ink-50">
                      <td className="px-2 py-1.5">
                        <span className="inline-flex items-center gap-1.5 font-medium">
                          <TokenIcon address={t.address} src={t.iconUrl} symbol={t.symbol} size={14} />
                          {t.symbol}
                        </span>
                      </td>
                      {items.map((w) => {
                        const hit = w.d?.tokens.find((x) => x.address === t.address);
                        return (
                          <td key={w.address} className="px-2 py-1.5 text-right">
                            {hit ? usd(hit.valueUsd) : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sub === "NFTs" && (
        <div className={`grid gap-2 ${items.length > 1 ? "md:grid-cols-2" : ""}`}>
          {items.map((w) => (
            <div key={w.address} className="card p-2">
              <div className="panel-title mb-1.5">{shortHash(w.address)}</div>
              <div className="space-y-1.5">
                {(w.d?.nfts ?? []).slice(0, 12).map((n) => (
                  <div key={n.address} className="flex justify-between text-[11px]">
                    <span className="truncate font-medium">{n.name || n.symbol}</span>
                    <span className="text-ink-500">×{n.count}</span>
                  </div>
                ))}
                {!w.d?.nfts.length && <div className="text-[11px] text-ink-400">No NFTs</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {sub === "Protocols" && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-ink-100 text-[10px] text-ink-400">
                  <th className="px-2 py-1.5 text-left font-medium">Protocol</th>
                  {items.map((w) => (
                    <th key={w.address} className="px-2 py-1.5 text-right font-medium">
                      {shortHash(w.address)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {protocols.map((p) => (
                  <tr key={p.slug} className="border-b border-ink-50">
                    <td className="px-2 py-1.5 font-medium">{p.name}</td>
                    {p.txs.map((n, i) => (
                      <td key={i} className="px-2 py-1.5 text-right">
                        {n} txs · {usd(p.vol[i])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
