import { addresses } from "@arclytics/chain";
import { protocols } from "@arclytics/protocols";
import type { Env } from "../lib/env";
import { createArcscan } from "../analytics/arcscan";
import { getDetail, getEco, getTokens, getWallets, listRankings, chainTvlSeries } from "../analytics/db";

const ADDR = /^0x[a-fA-F0-9]{40}$/;
const TX = /^0x[a-fA-F0-9]{64}$/;
const LINES = new Set([
  "accountsGrowth",
  "activeAccounts",
  "newAccounts",
  "averageTxnFee",
  "newTxns",
  "txnsFee",
  "txnsGrowth",
  "txnsSuccessRate",
  "averageBlockSize",
  "newBlocks",
  "newNativeCoinTransfers",
  "averageGasLimit",
  "averageGasPrice",
  "gasUsedGrowth",
  "networkUtilization",
  "averageGasUsed",
  "contractsGrowth",
  "newContracts",
  "newVerifiedContracts",
  "verifiedContractsGrowth",
  "userOpsGrowth",
  "newUserOps",
  "newAccountAbstractionWallets",
  "accountAbstractionWalletsGrowth",
  "activeAccountAbstractionWallets",
  "activeBundlers",
  "activePaymasters",
]);
const ACTIVE = new Set(protocols.map((p) => p.slug));

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

function money(v: unknown) {
  const n = num(v);
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function qty(v: unknown) {
  const n = num(v);
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

function lines(rows: Array<string | false | null | undefined>) {
  return rows.filter(Boolean).join("\n");
}

function pick(obj: Record<string, unknown> | null | undefined, keys: string[]) {
  const out: string[] = [];
  for (const k of keys) {
    const v = obj?.[k];
    if (v == null || v === "") continue;
    out.push(`${k.replace(/_/g, " ")} ${typeof v === "object" ? clip(v, 120) : String(v)}`);
  }
  return out;
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

function signedPct(v: unknown) {
  const n = num(v);
  if (!Number.isFinite(n)) return null;
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
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
  const toks = ((tokens?.items ?? []) as Array<Record<string, unknown>>).slice(0, 6);
  return lines([
    tvl > 0
      ? `TVL ${money(tvl)}${tvlCh ? ` (${tvlCh} 24h)` : ""} · ${qty(st.protocols ?? top.length)} protocols`
      : "TVL unavailable",
    `Volume 24h ${money(st.volume24h)} · fees 24h ${money(st.fees24h)} · users ${qty(st.activeUsers)}`,
    `ArcScan txs ${qty(s.total_transactions ?? c.totalTxns)} total · ${qty(c.newTxns24h ?? s.transactions_today)} new 24h · addresses ${qty(s.total_addresses ?? c.totalAddresses)} · blocks ${qty(s.total_blocks ?? c.totalBlocks)}`,
    head != null ? `RPC head ${num(head)} · gas ${num(gas)} wei · chain 5042002` : null,
    `Native USDC ${addresses.usdc}`,
    top.length
      ? `Protocols: ${top
          .map((r, i) => {
            const ch = signedPct(r.change24h);
            return `${i + 1}. ${r.name} (${r.category}) ${money(r.tvlUsd)}${ch ? ` ${ch}` : ""} vol ${money(r.volume24h)}`;
          })
          .join(" · ")}`
      : null,
    toks.length
      ? `Tokens: ${toks.map((t) => `${t.symbol ?? t.name} mcap ${money(t.marketCap)} holders ${qty(t.holders)}`).join(" · ")}`
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

const props = { type: "object" as const, properties: {} };

export const ASK_TOOLS = [
  {
    type: "function",
    function: {
      name: "lookup_token",
      description: `ArcScan token + top holders. Native USDC is ${addresses.usdc}.`,
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
      name: "lookup_address",
      description: "ArcScan address profile, balance, tokens, recent txs.",
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
      description: "ArcScan transaction by hash.",
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
      description: "ArcScan search for a name, token, address, or tx.",
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
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "rpc_live",
      description: "JSON-RPC head, gas price, optional balance.",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_protocol",
      description: "One protocol from Arclytics (slug e.g. synthra, wusdc, perpdex).",
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
      name: "arclytics_wallets",
      description: "Top wallets on Arclytics.",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "arc_docs",
      description: "Search docs.arc.io (gas, finality, RPC, App Kit, agentic economy, contracts).",
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
      case "arcscan_stats": {
        const [s, idx] = await Promise.all([
          v2(env, "/stats") as Promise<Record<string, unknown>>,
          v2(env, "/main-page/indexing-status").catch(() => null),
        ]);
        return lines([
          "ArcScan live stats (rewrite, do not dump):",
          `Transactions ${qty(s.total_transactions)}, today ${qty(s.transactions_today)}`,
          `Addresses ${qty(s.total_addresses)}, blocks ${qty(s.total_blocks)}`,
          `Gas used today ${qty(s.gas_used_today)}`,
          idx ? `Indexer ${clip(idx, 180)}` : null,
        ]);
      }
      case "stats_counters": {
        const c = (await statsApi(env, "/counters")) as Record<string, unknown>;
        return lines([
          "Stats-service counters:",
          `Accounts ${qty(c.totalAccounts)} vs addresses ${qty(c.totalAddresses)} (these differ)`,
          `Txs ${qty(c.totalTxns)}, 24h new txs ${qty(c.newTxns24h)}`,
          `Contracts ${qty(c.totalContracts)}, 24h fees ${c.txnsFee24h ?? c.fees24h ?? "—"}`,
        ]);
      }
      case "stats_page": {
        const page = String(args.page ?? "main");
        if (!["main", "transactions", "contracts"].includes(page)) return "invalid page";
        const data = (await statsApi(env, `/pages/${page}`)) as Record<string, unknown>;
        return lines([`Stats page ${page}:`, ...pick(data, Object.keys(data).slice(0, 12))]);
      }
      case "stats_line": {
        const id = String(args.name ?? "");
        if (!LINES.has(id)) return `unknown line ${id}`;
        const res = String(args.resolution ?? "DAY");
        const q = ["DAY", "WEEK", "MONTH", "YEAR"].includes(res) ? res : "DAY";
        const data = (await statsApi(env, `/lines/${id}?resolution=${q}`)) as {
          chart?: Array<{ date: string; value: string }>;
        };
        const pts = (data.chart ?? []).slice(-7);
        const last = pts.at(-1);
        return `${id} (${q}): last ${pts.length} points, latest ${last?.date ?? "—"} = ${last?.value ?? "—"}. Trend only, do not list every day.`;
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
        const tok = tokens.items.slice(0, 5).map((t) => {
          const r = t as Record<string, unknown>;
          const token = r.token as Record<string, unknown> | undefined;
          return String(token?.symbol ?? r.symbol ?? "?");
        });
        const last = txs.items[0] as Record<string, unknown> | undefined;
        return lines([
          `Address ${address} is ${profile.is_contract ? "a contract" : "a wallet"}.`,
          `Native balance ${profile.coin_balance ?? "—"}.`,
          `Tx count ${qty((counters as Record<string, unknown>).transactions_count)}.`,
          tok.length ? `Tokens seen: ${tok.join(", ")}.` : null,
          last?.hash ? `Latest tx ${String(last.hash).slice(0, 12)}…` : null,
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
        const top = holders.items.slice(0, 5).map((h, i) => {
          const r = h as Record<string, unknown>;
          const addr = String((r.address as Record<string, unknown>)?.hash ?? r.address ?? "").slice(0, 10);
          return `#${i + 1} ${addr}… ${r.value ?? r.balance ?? ""}`;
        });
        return lines([
          `Token ${t.name ?? ""} (${t.symbol ?? "?"}) at ${address}.`,
          `Holders ${qty((counters as Record<string, unknown>).token_holders_count ?? t.holders)}, transfers ${qty((counters as Record<string, unknown>).transfers_count)}.`,
          top.length ? `Top holders: ${top.join("; ")}.` : null,
        ]);
      }
      case "lookup_tx": {
        const hash = String(args.hash ?? "").toLowerCase();
        if (!TX.test(hash)) return "invalid tx hash";
        const tx = (await scan.transaction(hash)) as Record<string, unknown>;
        return lines([
          `Tx ${hash}`,
          `Status ${tx.status ?? tx.result ?? "—"}, block ${tx.block_number ?? "—"}`,
          `From ${tx.from ? clip(tx.from, 80) : "—"} to ${tx.to ? clip(tx.to, 80) : "—"}`,
          `Value ${tx.value ?? "—"}, fee ${tx.fee ? clip(tx.fee, 80) : "—"}`,
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
          .map((it) => `${it.type ?? "item"} ${it.name ?? it.symbol ?? it.address ?? it.hash ?? clip(it, 80)}`)
          .join("\n");
      }
      case "recent_activity": {
        const [txs, blocks] = await Promise.all([v2(env, "/transactions"), v2(env, "/main-page/blocks")]);
        const items = ((txs as { items?: Array<Record<string, unknown>> }).items ?? []).slice(0, 5);
        const bl = (Array.isArray(blocks) ? blocks : []) as Array<Record<string, unknown>>;
        return lines([
          "Recent ArcScan activity:",
          ...items.map((t) => `tx ${String(t.hash ?? "").slice(0, 12)}… block ${t.block_number ?? "?"}`),
          ...bl.slice(0, 3).map((b) => `block ${b.height ?? b.number ?? "?"} txs ${b.tx_count ?? b.transaction_count ?? ""}`),
        ]);
      }
      case "arcscan_tokens": {
        const data = (await v2(env, "/tokens?type=ERC-20")) as { items?: Array<Record<string, unknown>> };
        const items = (data.items ?? []).slice(0, 10);
        return items
          .map((t) => `${t.symbol ?? t.name} holders ${qty(t.holders)} transfers ${qty(t.transfers_count ?? t.transfer_count)}`)
          .join("\n");
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
        return lines([
          `JSON-RPC ${rpcUrl(env)}`,
          `Chain id ${num(chainId)} (expect 5042002), head block ${num(blockNumber)}`,
          `Gas price ${num(gasPrice)} wei`,
          `Latest block txs ${Array.isArray(latest.transactions) ? latest.transactions.length : "—"}`,
          bal != null ? `Balance of ${address}: ${num(bal)}` : null,
        ]);
      }
      case "arclytics_protocols": {
        const rows = (await listRankings(env))
          .filter((r) => ACTIVE.has(r.slug))
          .sort((a, b) => b.tvlUsd - a.tvlUsd)
          .slice(0, 10);
        return lines([
          "Arclytics protocol rankings (backend D1):",
          ...rows.map(
            (r, i) =>
              `${i + 1}. ${r.name} (${r.category}) TVL ${money(r.tvlUsd)}, 24h vol ${money(r.volume24h)}`,
          ),
        ]);
      }
      case "arclytics_protocol": {
        const slug = String(args.slug ?? "").toLowerCase();
        const d = await getDetail(env, slug);
        if (!d) return "protocol not found";
        return lines([
          `${d.protocol.name} is a ${d.protocol.category} protocol.`,
          d.protocol.description ? String(d.protocol.description).slice(0, 400) : null,
          `TVL ${money(d.tvlUsd)} (${d.change24h != null ? `${d.change24h.toFixed(2)}% 24h` : "no 24h change"}), volume ${money(d.volume24h)}, fees ${money(d.fees24h)}.`,
        ]);
      }
      case "arclytics_ecosystem": {
        const eco = (await getEco(env)) as {
          stats?: Record<string, unknown>;
          rows?: Array<Record<string, unknown>>;
        } | null;
        if (!eco) return "no ecosystem data yet";
        const s = eco.stats ?? {};
        const top = (eco.rows ?? []).slice(0, 6);
        return lines([
          `Ecosystem TVL ${money(s.tvlUsd)}, 24h volume ${money(s.volume24h)}, fees ${money(s.fees24h)}, active users ${qty(s.activeUsers)}.`,
          ...top.map((r) => `${r.name} ${money(r.tvlUsd)}`),
        ]);
      }
      case "arclytics_tvl": {
        const series = await chainTvlSeries(env, 90);
        const latest = series.at(-1)?.value ?? 0;
        const first = series.find((p) => p.value > 0)?.value ?? 0;
        const pct = first > 0 ? ((latest - first) / first) * 100 : 0;
        return `Arc chain TVL from Arclytics snapshots: ${money(latest)}, ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% over ~${series.length} days. Explain the move; do not list dates.`;
      }
      case "arclytics_tokens": {
        const data = await getTokens(env);
        const items = (data?.items ?? []) as Array<Record<string, unknown>>;
        return lines([
          "Arclytics token feed:",
          ...items.slice(0, 10).map(
            (t) => `${t.symbol ?? t.name} mcap ${money(t.marketCap)} vol ${money(t.volume24h)} holders ${qty(t.holders)}`,
          ),
        ]);
      }
      case "arclytics_wallets": {
        const data = await getWallets(env);
        const items = (data?.items ?? []) as Array<Record<string, unknown>>;
        return lines([
          "Top wallets on Arclytics:",
          ...items.slice(0, 8).map(
            (w) => `${w.label || String(w.address).slice(0, 10)} net ${money(w.netWorth)}, 24h txs ${qty(w.txs24h)}`,
          ),
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
