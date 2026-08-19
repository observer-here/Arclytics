import { addresses } from "@arclytics/chain";
import { protocols } from "@arclytics/protocols";
import type { Env } from "../lib/env";
import { createArcscan } from "../analytics/arcscan";
import {
  chainTvlSeries,
  getDetail,
  getEco,
  getTokens,
  getWallets,
  listRankings,
  seriesFor,
  tokenSeriesFor,
} from "../analytics/db";

const ADDR = /^0x[a-fA-F0-9]{40}$/;
const TX = /^0x[a-fA-F0-9]{64}$/;
const ACTIVE = new Set(protocols.map((p) => p.slug));

const PROTOCOL_FIELDS = ["tvl", "volume", "fees", "users"] as const;
const TOKEN_FIELDS = ["price", "mcap", "holders"] as const;
type ProtocolField = (typeof PROTOCOL_FIELDS)[number];
type TokenField = (typeof TOKEN_FIELDS)[number];

function clip(v: unknown, n = 2200) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + "…" : s;
}

function num(v: unknown) {
  if (typeof v === "string" && v.startsWith("0x")) {
    try {
      return Number(BigInt(v));
    } catch {
      return 0;
    }
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Raw on-chain integer -> human number. Arc native USDC is 18dp, the ERC-20 interface is 6dp. */
function scaled(raw: unknown, decimals: number) {
  const s = typeof raw === "string" ? raw.trim() : String(raw ?? "");
  if (!s) return 0;
  try {
    const big = s.startsWith("0x") ? BigInt(s) : BigInt(s.split(".")[0]);
    return Number(big) / 10 ** decimals;
  } catch {
    return num(raw) / 10 ** decimals;
  }
}

function money(v: unknown) {
  const n = num(v);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function price(v: unknown) {
  const n = num(v);
  if (!n) return "—";
  return n < 1 ? `$${n.toPrecision(4)}` : `$${n.toFixed(4)}`;
}

function qty(v: unknown) {
  const n = num(v);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function usdc(raw: unknown, decimals = 18) {
  const n = scaled(raw, decimals);
  if (!n) return "0 USDC";
  return `${n < 1 ? n.toPrecision(3) : n.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC`;
}

function signedPct(v: unknown) {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function lines(rows: Array<string | false | null | undefined>) {
  return rows.filter(Boolean).join("\n");
}

type DocHit = { title: string; url: string; blurb: string };
let docsIndex: DocHit[] | null = null;

async function loadDocsIndex(): Promise<DocHit[]> {
  if (docsIndex) return docsIndex;
  const res = await fetch("https://docs.arc.io/llms.txt", { headers: { accept: "text/plain" } });
  if (!res.ok) throw new Error(`docs index -> ${res.status}`);
  const txt = await res.text();
  const hits: DocHit[] = [];
  const re = /\[([^\]]+)\]\((https:\/\/docs\.arc\.io\/[^)]+\.md)\)(?:\s*:\s*(.+))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(txt))) {
    hits.push({ title: m[1], url: m[2], blurb: (m[3] ?? "").trim() });
  }
  docsIndex = hits;
  return hits;
}

function scoreDoc(q: string, hit: DocHit) {
  const words = q.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
  const hay = `${hit.title} ${hit.blurb} ${hit.url}`.toLowerCase();
  return words.reduce((s, w) => s + (hay.includes(w) ? 2 : 0) + (hit.title.toLowerCase().includes(w) ? 3 : 0), 0);
}

async function fetchDoc(url: string) {
  const res = await fetch(url, { headers: { accept: "text/plain, text/markdown" } });
  if (!res.ok) return "";
  let t = await res.text();
  t = t.replace(/^---[\s\S]*?---\s*/, "").replace(/<[^>]+>/g, " ");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[#*_`>]/g, "");
  return clip(t.replace(/\n{3,}/g, "\n\n").trim(), 2800);
}

export async function searchArcDocs(q: string) {
  const query = q.trim();
  if (query.length < 2) return "query too short";
  const index = await loadDocsIndex();
  const ranked = index
    .map((h) => ({ h, s: scoreDoc(query, h) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 3);
  const picks = ranked.length ? ranked.map((x) => x.h) : index.slice(0, 2);
  const pages = await Promise.all(
    picks.slice(0, 2).map(async (h) => {
      const body = await fetchDoc(h.url);
      return `## ${h.title}\n${h.url}\n${body}`;
    }),
  );
  return clip(`${picks.map((h) => `${h.title} (${h.url})`).join("\n")}\n\n${pages.join("\n\n")}`, 5000);
}

export async function liveBrief(env: Env) {
  const [eco, stats, counters, head, gas, ranks, tokens] = await Promise.all([
    getEco(env).catch(() => null),
    v2(env, "/stats").catch(() => ({})),
    statsApi(env, "/counters").catch(() => ({})),
    rpc(env, "eth_blockNumber").catch(() => null),
    rpc(env, "eth_gasPrice").catch(() => null),
    listRankings(env).catch(() => []),
    getTokens(env).catch(() => null),
  ]);
  const e = eco as { stats?: Record<string, unknown> } | null;
  const s = (stats ?? {}) as Record<string, unknown>;
  const c = (counters ?? {}) as Record<string, unknown>;
  const st = e?.stats ?? {};
  const tvl = num(st.tvlUsd);
  const top = ranks
    .filter((r) => ACTIVE.has(r.slug))
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, 8);
  const tvlCh = signedPct(st.tvlChange);
  const toks = ((tokens?.items ?? []) as Array<Record<string, unknown>>).slice(0, 8);
  const gwei = gas != null ? scaled(gas, 9) : null;
  return lines([
    tvl > 0
      ? `TVL ${money(tvl)}${tvlCh ? ` (${tvlCh} 24h)` : ""} across ${qty(st.protocols ?? top.length)} tracked protocols (${protocols.length} in the registry)`
      : "TVL unavailable",
    `Volume 24h ${money(st.volume24h)} · fees 24h ${money(st.fees24h)} · active users 24h ${qty(st.activeUsers)} · stablecoin mcap ${money(st.stableMcap)}`,
    `ArcScan: ${qty(s.total_transactions ?? c.totalTxns)} txs total · ${qty(c.newTxns24h ?? s.transactions_today)} new 24h · ${qty(s.total_addresses ?? c.totalAddresses)} addresses · ${qty(s.total_blocks ?? c.totalBlocks)} blocks · ${qty(c.totalContracts)} contracts`,
    head != null
      ? `RPC head block ${num(head)}${gwei ? ` · gas ${gwei.toFixed(1)} Gwei (protocol floor is 20 Gwei)` : ""}`
      : null,
    top.length
      ? `Top protocols: ${top
          .map((r, i) => {
            const ch = signedPct(r.change24h);
            return `${i + 1}. ${r.name} [${r.slug}] ${r.category} TVL ${money(r.tvlUsd)}${ch ? ` ${ch}` : ""} vol ${money(r.volume24h)}`;
          })
          .join(" · ")}`
      : null,
    toks.length
      ? `Top tokens: ${toks
          .map((t) => `${t.symbol ?? t.name} ${price(t.price)} mcap ${money(t.marketCap)} holders ${qty(t.holders)}`)
          .join(" · ")}`
      : null,
  ]);
}

function rpcUrl(env: Env) {
  return (env.ARC_RPC || "https://rpc.testnet.arc.network").replace(/\/$/, "");
}

async function getJson(url: string, label: string) {
  let last = new Error(label);
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (res.ok) return res.json();
    last = new Error(`${label} -> ${res.status}`);
    if (res.status !== 429 && res.status < 500) throw last;
    await new Promise((r) => setTimeout(r, 400 * 2 ** i));
  }
  throw last;
}

async function v2(env: Env, path: string) {
  return getJson(`${env.ARCSCAN_BASE.replace(/\/$/, "")}${path}`, `ArcScan ${path}`);
}

async function statsApi(env: Env, path: string) {
  return getJson(`${env.ARCSCAN_STATS.replace(/\/$/, "")}${path}`, `ArcStats ${path}`);
}

async function rpc(env: Env, method: string, params: unknown[] = []) {
  const res = await fetch(rpcUrl(env), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} -> ${res.status}`);
  const data = (await res.json()) as { result?: unknown; error?: { message?: string } };
  if (data.error) throw new Error(data.error.message || method);
  return data.result;
}

type TokenRow = Record<string, unknown> & { address?: string; symbol?: string; name?: string };

/** Resolve free text to a tracked protocol and/or a token in the Arclytics feed. */
async function resolve(env: Env, raw: string) {
  const q = raw.trim().toLowerCase();
  const protoHits = q
    ? protocols.filter(
        (p) => p.slug === q || p.name.toLowerCase() === q || p.slug.includes(q) || p.name.toLowerCase().includes(q),
      )
    : [];
  const feed = await getTokens(env).catch(() => null);
  const items = (feed?.items ?? []) as TokenRow[];
  const tokenHits = q
    ? items.filter((t) => {
        const sym = String(t.symbol ?? "").toLowerCase();
        const name = String(t.name ?? "").toLowerCase();
        const addr = String(t.address ?? "").toLowerCase();
        return addr === q || sym === q || name === q || sym.includes(q) || name.includes(q);
      })
    : [];
  return { protoHits: protoHits.slice(0, 5), tokenHits: tokenHits.slice(0, 5) };
}

export type Subject =
  | { kind: "protocol"; slug: string; name: string }
  | { kind: "token"; address: string; symbol: string };

/** Scan a free-form question for the protocol or curated token it is about. */
export async function matchSubject(env: Env, text: string): Promise<Subject | null> {
  const t = text.toLowerCase();
  const p = protocols.find((x) => t.includes(x.slug) || t.includes(x.name.toLowerCase()));
  if (p) return { kind: "protocol", slug: p.slug, name: p.name };
  const feed = await getTokens(env).catch(() => null);
  const hit = ((feed?.items ?? []) as TokenRow[]).find((x) => {
    const addr = String(x.address ?? "").toLowerCase();
    if (addr && t.includes(addr)) return true;
    const sym = String(x.symbol ?? "").toLowerCase();
    return sym.length > 2 && new RegExp(`\\b${sym.replace(/[^a-z0-9]/g, ".")}\\b`).test(t);
  });
  if (!hit?.address) return null;
  return { kind: "token", address: String(hit.address), symbol: String(hit.symbol ?? hit.name ?? "token") };
}

function tokenLine(t: TokenRow) {
  return lines([
    `${t.symbol ?? t.name} — ${t.name ?? ""} at ${t.address}`,
    `Price ${price(t.price)}${signedPct(t.change24h) ? ` (${signedPct(t.change24h)} 24h)` : ""}${signedPct(t.change7d) ? `, ${signedPct(t.change7d)} 7d` : ""}`,
    `Market cap ${money(t.marketCap)} · 24h volume ${money(t.volume24h)} · ${qty(t.holders)} holders · ${qty(t.transfers)} transfers`,
    t.category || t.protocol ? `Category ${t.category ?? "—"}, protocol ${t.protocol ?? "—"}` : null,
    `In-app page /tokens/${t.address}`,
  ]);
}

function trend(title: string, series: Array<{ date: string; value: number }>, fmt: (v: unknown) => string) {
  const live = series.filter((p) => p.value > 0);
  if (!live.length) return `${title}: no history recorded yet.`;
  const first = live[0];
  const last = live[live.length - 1];
  const peak = live.reduce((a, b) => (b.value > a.value ? b : a));
  const pct = first.value > 0 ? ((last.value - first.value) / first.value) * 100 : 0;
  return lines([
    `${title} over ${series.length} days (${live.length} with data).`,
    `Now ${fmt(last.value)} on ${last.date}, started ${fmt(first.value)} on ${first.date} — ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}%.`,
    `Peak ${fmt(peak.value)} on ${peak.date}.`,
    "Describe the shape of the move. Do not list every day.",
  ]);
}

const noArgs = { type: "object" as const, properties: {} };

export const ASK_TOOLS = [
  {
    type: "function",
    function: {
      name: "arclytics_find",
      description:
        "Resolve a protocol or token by name, symbol, slug, or address. Use this first whenever the user names something that is not already in the snapshot — it returns the slug/address you need for the other tools plus the in-app link.",
      parameters: {
        type: "object",
        properties: { q: { type: "string", description: "Name, symbol, slug, or 0x address" } },
        required: ["q"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_protocol",
      description: "Full Arclytics detail for one protocol slug: TVL, volume, fees, users, changes, top pairs, contracts.",
      parameters: {
        type: "object",
        properties: { slug: { type: "string" } },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_token",
      description: "Arclytics feed data for one token by symbol or address: price, market cap, 24h volume, holders, changes.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Symbol or 0x address" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_series",
      description:
        "Historical trend from Arclytics snapshots. metric tvl/volume/fees/users needs a protocol slug (omit subject for chain-wide TVL); metric price/mcap/holders needs a token symbol or address.",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", enum: [...PROTOCOL_FIELDS, ...TOKEN_FIELDS] },
          subject: { type: "string", description: "Protocol slug, or token symbol/address" },
          days: { type: "number", description: "Lookback window, default 30, max 365" },
        },
        required: ["metric"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_wallets",
      description: "Top tracked wallets on Arclytics with net worth and labels.",
      parameters: noArgs,
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_address",
      description: `ArcScan profile for any address: wallet or contract, native USDC balance, tx count, tokens held. Native USDC is ${addresses.usdc}.`,
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_token",
      description: "ArcScan token metadata, supply, and top holders for any token address, including ones Arclytics does not track.",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
        required: ["address"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_tx",
      description: "ArcScan transaction by hash: status, block, from/to, value, fee.",
      parameters: {
        type: "object",
        properties: { hash: { type: "string" } },
        required: ["hash"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_chain",
      description: "ArcScan full-chain search. Use for contracts, tokens, or names Arclytics does not track.",
      parameters: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "recent_activity",
      description: "Latest ArcScan transactions and blocks.",
      parameters: noArgs,
    },
  },
  {
    type: "function",
    function: {
      name: "rpc_live",
      description: "JSON-RPC chain head, chain id, gas price, and optionally a native USDC balance.",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arc_docs",
      description: "Search docs.arc.io for how Arc works: gas and fees, finality, RPC, App Kit, CCTP, agentic economy, contract addresses.",
      parameters: {
        type: "object",
        properties: { q: { type: "string" } },
        required: ["q"],
      },
    },
  },
];

export async function runAskTool(env: Env, name: string, rawArgs: string): Promise<string> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};
  } catch {
    args = {};
  }
  const scan = createArcscan(env);
  try {
    switch (name) {
      case "arclytics_find": {
        const q = String(args.q ?? "").trim();
        if (q.length < 2) return "query too short";
        const { protoHits, tokenHits } = await resolve(env, q);
        if (!protoHits.length && !tokenHits.length) {
          return `Arclytics does not track "${q}". Try search_chain or lookup_address for raw ArcScan data.`;
        }
        const ranks = protoHits.length ? await listRankings(env).catch(() => []) : [];
        const byslug = new Map(ranks.map((r) => [r.slug, r]));
        return lines([
          ...protoHits.map((p) => {
            const r = byslug.get(p.slug);
            return `Protocol ${p.name} [slug ${p.slug}] ${p.category}${
              r ? ` — TVL ${money(r.tvlUsd)}, 24h vol ${money(r.volume24h)}` : ""
            } — in-app page /protocols/${p.slug}`;
          }),
          ...tokenHits.map(
            (t) =>
              `Token ${t.symbol ?? t.name} [${t.address}] — ${price(t.price)}, mcap ${money(t.marketCap)} — in-app page /tokens/${t.address}`,
          ),
        ]);
      }
      case "arclytics_protocol": {
        const slug = String(args.slug ?? "").toLowerCase();
        const d = await getDetail(env, slug);
        if (!d) {
          const { protoHits } = await resolve(env, slug);
          return protoHits.length
            ? `No detail stored for "${slug}". Closest tracked slugs: ${protoHits.map((p) => p.slug).join(", ")}.`
            : `"${slug}" is not a tracked protocol.`;
        }
        const pairs = (d.pairs ?? []).slice(0, 4).map((p) => `${p.pair} ${money(p.volume24h)} 24h vol`);
        const ch24 = signedPct(d.change24h);
        return lines([
          `${d.protocol.name} is a ${d.protocol.category} protocol on Arc Testnet, ranked #${d.rank ?? "—"} by TVL.`,
          d.protocol.description ? String(d.protocol.description).slice(0, 400) : null,
          `TVL ${money(d.tvlUsd)}${ch24 ? ` (${ch24} 24h)` : ""} · 24h volume ${money(d.volume24h)}${signedPct(d.changeVol) ? ` (${signedPct(d.changeVol)})` : ""} · 24h fees ${money(d.fees24h)} · 24h active users ${qty(d.activeUsers)}`,
          `${qty(d.totals?.txs)} transactions and ${qty(d.totals?.transfers)} transfers lifetime across ${(d.contracts ?? []).length} tracked contracts${d.age ? `, live for ${d.age}` : ""}.`,
          pairs.length ? `Top pools: ${pairs.join(" · ")}` : null,
          `In-app page /protocols/${slug}`,
        ]);
      }
      case "arclytics_token": {
        const q = String(args.query ?? "").trim();
        const { tokenHits } = await resolve(env, q);
        if (!tokenHits.length) return `"${q}" is not in the Arclytics token feed. Try lookup_token with a 0x address.`;
        return tokenHits.slice(0, 2).map(tokenLine).join("\n\n");
      }
      case "arclytics_series": {
        const metric = String(args.metric ?? "tvl").toLowerCase();
        const subject = String(args.subject ?? "").trim();
        const days = Math.min(365, Math.max(7, Math.round(num(args.days) || 30)));
        if ((TOKEN_FIELDS as readonly string[]).includes(metric)) {
          const { tokenHits } = await resolve(env, subject);
          const t = tokenHits[0];
          if (!t?.address) return `Need a tracked token for ${metric}. "${subject}" did not resolve.`;
          const series = await tokenSeriesFor(env, String(t.address), metric as TokenField, days);
          const fmt = metric === "holders" ? qty : metric === "price" ? price : money;
          return trend(`${t.symbol ?? t.name} ${metric}`, series, fmt);
        }
        if (!(PROTOCOL_FIELDS as readonly string[]).includes(metric)) return `unsupported metric ${metric}`;
        if (!subject) {
          return trend("Arc chain TVL", await chainTvlSeries(env, days), money);
        }
        const { protoHits } = await resolve(env, subject);
        const p = protoHits[0];
        if (!p) return `"${subject}" is not a tracked protocol.`;
        const series = await seriesFor(env, p.slug, metric as ProtocolField, days);
        return trend(`${p.name} ${metric}`, series, metric === "users" ? qty : money);
      }
      case "arclytics_wallets": {
        const data = await getWallets(env);
        const items = (data?.items ?? []) as Array<Record<string, unknown>>;
        if (!items.length) return "No wallet data yet.";
        return lines([
          "Top tracked wallets (Arclytics):",
          ...items.slice(0, 8).map((w, i) => {
            const addr = String(w.address ?? "");
            return `${i + 1}. ${addr.slice(0, 10)}… ${w.label ? `(${w.label})` : ""} net worth ${money(w.netWorth)}, ${qty(w.txsTotal ?? w.txs24h)} txs — /address/${addr}`;
          }),
          "Wallet tracker page /tools/wallet",
        ]);
      }
      case "lookup_address": {
        const address = String(args.address ?? "").toLowerCase();
        if (!ADDR.test(address)) return "invalid address";
        const [profile, counters, tokens, txs] = await Promise.all([
          scan.address(address),
          scan.addressCounters(address).catch(() => ({})),
          scan.addressTokens(address).catch(() => ({ items: [] })),
          scan.addressTransactions(address).catch(() => ({ items: [] })),
        ]);
        const c = counters as Record<string, unknown>;
        const tok = tokens.items.slice(0, 6).map((t) => {
          const r = t as Record<string, unknown>;
          const meta = (r.token ?? {}) as Record<string, unknown>;
          const sym = String(meta.symbol ?? r.symbol ?? "?");
          const dec = num(meta.decimals ?? 18) || 18;
          return `${sym} ${scaled(r.value ?? r.balance, dec).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
        });
        const last = txs.items[0] as Record<string, unknown> | undefined;
        return lines([
          `Address ${address} is ${profile.is_contract ? "a contract" : "a wallet"}${profile.name ? ` named ${profile.name}` : ""}.`,
          `Native balance ${usdc(profile.coin_balance)} (Arc native USDC, 18 decimals).`,
          `${qty(c.transactions_count)} transactions, ${qty(c.token_transfers_count)} token transfers.`,
          tok.length ? `Holdings: ${tok.join(", ")}.` : "No ERC-20 balances.",
          last?.hash ? `Latest tx ${String(last.hash)}.` : null,
          `In-app page /address/${address}`,
        ]);
      }
      case "lookup_token": {
        const address = String(args.address ?? "").toLowerCase();
        if (!ADDR.test(address)) return "invalid token address";
        const [token, counters, holders] = await Promise.all([
          scan.token(address),
          scan.tokenCounters(address).catch(() => ({})),
          scan.tokenHolders(address).catch(() => ({ items: [] })),
        ]);
        const t = token as Record<string, unknown>;
        const c = counters as Record<string, unknown>;
        const dec = num(t.decimals ?? 18) || 18;
        const top = holders.items.slice(0, 5).map((h, i) => {
          const r = h as Record<string, unknown>;
          const addr = String((r.address as Record<string, unknown>)?.hash ?? r.address ?? "");
          const bal = scaled(r.value ?? r.balance, dec);
          return `#${i + 1} ${addr.slice(0, 12)}… ${bal.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
        });
        return lines([
          `Token ${t.name ?? ""} (${t.symbol ?? "?"}), ${t.type ?? "ERC-20"} at ${address}, ${dec} decimals.`,
          t.total_supply ? `Total supply ${scaled(t.total_supply, dec).toLocaleString("en-US", { maximumFractionDigits: 0 })} ${t.symbol ?? ""}.` : null,
          `${qty(c.token_holders_count ?? t.holders)} holders, ${qty(c.transfers_count)} transfers.`,
          top.length ? `Top holders: ${top.join("; ")}.` : null,
          `In-app page /tokens/${address}`,
        ]);
      }
      case "lookup_tx": {
        const hash = String(args.hash ?? "").toLowerCase();
        if (!TX.test(hash)) return "invalid tx hash";
        const tx = (await scan.transaction(hash)) as Record<string, unknown>;
        const from = (tx.from ?? {}) as Record<string, unknown>;
        const to = (tx.to ?? {}) as Record<string, unknown>;
        return lines([
          `Tx ${hash} — ${tx.status ?? tx.result ?? "unknown status"} in block ${tx.block_number ?? tx.block ?? "—"}.`,
          `From ${from.hash ?? "—"} to ${to.hash ?? "—"}${to.is_contract ? " (a contract)" : ""}.`,
          `Value ${usdc(tx.value)}, fee ${usdc((tx.fee as Record<string, unknown>)?.value ?? tx.fee)}.`,
          tx.method ? `Method ${tx.method}.` : null,
          `Arc has deterministic finality — one confirmation is final.`,
        ]);
      }
      case "search_chain": {
        const q = String(args.q ?? "").trim();
        if (q.length < 2) return "query too short";
        const data = (await v2(env, `/search/quick?q=${encodeURIComponent(q)}`)) as {
          items?: Array<Record<string, unknown>>;
        };
        const items = (data.items ?? []).slice(0, 6);
        if (!items.length) return `No ArcScan hits for "${q}".`;
        return items
          .map((it) => `${it.type ?? "item"} ${it.name ?? it.symbol ?? ""} ${it.address ?? it.hash ?? ""}`.trim())
          .join("\n");
      }
      case "recent_activity": {
        const [txs, blocks] = await Promise.all([v2(env, "/transactions"), v2(env, "/main-page/blocks")]);
        const items = ((txs as { items?: Array<Record<string, unknown>> }).items ?? []).slice(0, 5);
        const bl = (Array.isArray(blocks) ? blocks : []) as Array<Record<string, unknown>>;
        return lines([
          "Recent ArcScan activity:",
          ...items.map(
            (t) =>
              `tx ${String(t.hash ?? "").slice(0, 14)}… ${t.method ?? "transfer"} ${usdc(t.value)} in block ${t.block_number ?? "?"}`,
          ),
          ...bl.slice(0, 3).map((b) => `block ${b.height ?? b.number ?? "?"} with ${b.tx_count ?? b.transaction_count ?? "?"} txs`),
          "Full feed /explorer",
        ]);
      }
      case "rpc_live": {
        const address = String(args.address ?? "").toLowerCase();
        const [blockNumber, gasPrice, chainId, block] = await Promise.all([
          rpc(env, "eth_blockNumber"),
          rpc(env, "eth_gasPrice"),
          rpc(env, "eth_chainId"),
          rpc(env, "eth_getBlockByNumber", ["latest", false]),
        ]);
        const latest = (block ?? {}) as Record<string, unknown>;
        const bal = ADDR.test(address) ? await rpc(env, "eth_getBalance", [address, "latest"]) : null;
        const gwei = scaled(gasPrice, 9);
        return lines([
          `Live from ${rpcUrl(env)} — chain id ${num(chainId)} (Arc Testnet is 5042002).`,
          `Head block ${num(blockNumber)} with ${Array.isArray(latest.transactions) ? latest.transactions.length : "—"} txs, ~0.48s block time.`,
          `Gas price ${gwei.toFixed(2)} Gwei${gwei <= 20.5 ? " — sitting at the 20 Gwei protocol floor" : ""}. Fees are paid in USDC.`,
          bal != null ? `Balance of ${address}: ${usdc(bal)}.` : null,
        ]);
      }
      case "arc_docs":
        return searchArcDocs(String(args.q ?? ""));
      default:
        return `unknown tool ${name}`;
    }
  } catch (err) {
    return clip({ error: String(err) }, 500);
  }
}
