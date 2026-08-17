import { protocols } from "@arclytics/protocols";
import type { Env } from "./env";
import { createArcscan } from "./arcscan";
import { getDetail, getEco, getTokens, getWallets, listRankings, chainTvlSeries } from "./db";

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

function clip(v: unknown, n = 8000) {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s.length > n ? s.slice(0, n) + "…" : s;
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
      name: "arcscan_stats",
      description: "Live ArcScan /api/v2/stats + indexer status — txs, addresses, blocks, gas today.",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "stats_counters",
      description:
        "Live stats-service /counters — newTxns24h, fees, totalAccounts vs totalAddresses, contracts, AA.",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "stats_page",
      description: "Live stats-service /pages/{main|transactions|contracts} KPIs.",
      parameters: {
        type: "object",
        properties: { page: { type: "string", enum: ["main", "transactions", "contracts"] } },
        required: ["page"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "stats_line",
      description: "Live stats-service chart /lines/{name} (newTxns, newAccounts, newContracts, …).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string" },
          resolution: { type: "string", enum: ["DAY", "WEEK", "MONTH", "YEAR"] },
        },
        required: ["name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "lookup_address",
      description: "Live ArcScan address: balance, contract, counters, ERC-20s, recent txs.",
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
      description: "Live ArcScan token metadata, counters, top holders.",
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
      description: "Live ArcScan transaction by hash.",
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
      description: "Live ArcScan quick search (address, token, tx, name).",
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
      description: "Live recent txs + latest blocks from ArcScan.",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "arcscan_tokens",
      description: "Live ArcScan ERC-20 token list (holders, transfers) — not a cached snapshot.",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "rpc_live",
      description: "Live JSON-RPC: eth_blockNumber, eth_gasPrice, optional eth_getBalance.",
      parameters: {
        type: "object",
        properties: { address: { type: "string" } },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_protocols",
      description: "Current Arclytics /v1/protocols rankings (same live backend as the site).",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_protocol",
      description: "Current Arclytics /v1/protocols/{slug} detail.",
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
      name: "arclytics_ecosystem",
      description: "Current Arclytics /v1/ecosystem totals.",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_tokens",
      description: "Current Arclytics /v1/tokens feed (price, mcap, volume, holders).",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_tvl",
      description: "Live Arclytics chain TVL time series (sum of protocol snapshots).",
      parameters: props,
    },
  },
  {
    type: "function",
    function: {
      name: "arclytics_wallets",
      description: "Current Arclytics /v1/wallets tracker rankings.",
      parameters: props,
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
          v2(env, "/stats"),
          v2(env, "/main-page/indexing-status").catch(() => null),
        ]);
        return clip({ stats: s, indexing: idx });
      }
      case "stats_counters":
        return clip(await statsApi(env, "/counters"));
      case "stats_page": {
        const page = String(args.page ?? "main");
        if (!["main", "transactions", "contracts"].includes(page)) return "invalid page";
        return clip(await statsApi(env, `/pages/${page}`));
      }
      case "stats_line": {
        const id = String(args.name ?? "");
        if (!LINES.has(id)) return `unknown line ${id}`;
        const res = String(args.resolution ?? "DAY");
        const q = ["DAY", "WEEK", "MONTH", "YEAR"].includes(res) ? res : "DAY";
        const data = (await statsApi(env, `/lines/${id}?resolution=${q}`)) as {
          chart?: Array<{ date: string; value: string }>;
        };
        return clip({ name: id, resolution: q, points: (data.chart ?? []).slice(-14) });
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
        return clip({
          profile,
          counters,
          tokens: tokens.items.slice(0, 8),
          txs: txs.items.slice(0, 6),
        });
      }
      case "lookup_token": {
        const address = String(args.address ?? "").toLowerCase();
        if (!ADDR.test(address)) return "invalid token address";
        const [token, counters, holders] = await Promise.all([
          scan.token(address),
          scan.tokenCounters(address).catch(() => ({})),
          scan.tokenHolders(address).catch(() => ({ items: [] })),
        ]);
        return clip({ token, counters, holders: holders.items.slice(0, 8) });
      }
      case "lookup_tx": {
        const hash = String(args.hash ?? "").toLowerCase();
        if (!TX.test(hash)) return "invalid tx hash";
        return clip(await scan.transaction(hash));
      }
      case "search_chain": {
        const q = String(args.q ?? "").trim();
        if (q.length < 2) return "query too short";
        return clip(await v2(env, `/search/quick?q=${encodeURIComponent(q)}`));
      }
      case "recent_activity": {
        const [txs, blocks] = await Promise.all([v2(env, "/transactions"), v2(env, "/main-page/blocks")]);
        const items = ((txs as { items?: unknown[] }).items ?? []).slice(0, 8);
        const bl = Array.isArray(blocks) ? blocks.slice(0, 5) : blocks;
        return clip({ txs: items, blocks: bl });
      }
      case "arcscan_tokens": {
        const data = (await v2(env, "/tokens?type=ERC-20")) as { items?: unknown[] };
        return clip((data.items ?? []).slice(0, 15));
      }
      case "rpc_live": {
        const address = String(args.address ?? "").toLowerCase();
        const [blockNumber, gasPrice, balance] = await Promise.all([
          rpc(env, "eth_blockNumber"),
          rpc(env, "eth_gasPrice"),
          ADDR.test(address) ? rpc(env, "eth_getBalance", [address, "latest"]) : Promise.resolve(null),
        ]);
        return clip({ blockNumber, gasPrice, balance, rpc: rpcUrl(env) });
      }
      case "arclytics_protocols": {
        const rows = (await listRankings(env))
          .filter((r) => ACTIVE.has(r.slug))
          .sort((a, b) => b.tvlUsd - a.tvlUsd)
          .slice(0, 15)
          .map((r) => ({
            slug: r.slug,
            name: r.name,
            category: r.category,
            tvlUsd: r.tvlUsd,
            volume24h: r.volume24h,
            fees24h: r.fees24h,
            txs: r.txs,
            updatedAt: r.updatedAt,
          }));
        return clip(rows);
      }
      case "arclytics_protocol": {
        const slug = String(args.slug ?? "").toLowerCase();
        const d = await getDetail(env, slug);
        if (!d) return "protocol not found";
        return clip({
          slug: d.protocol.slug,
          name: d.protocol.name,
          category: d.protocol.category,
          tvlUsd: d.tvlUsd,
          volume24h: d.volume24h,
          fees24h: d.fees24h,
          activeUsers: d.activeUsers,
          change24h: d.change24h,
          description: d.protocol.description,
          updatedAt: d.updatedAt,
        });
      }
      case "arclytics_ecosystem":
        return clip((await getEco(env)) ?? { error: "no ecosystem data yet" });
      case "arclytics_tvl": {
        const series = await chainTvlSeries(env, 90);
        const latest = series.at(-1)?.value ?? 0;
        return clip({ latest, points: series.filter((_, i) => i % 2 === 0 || i === series.length - 1) });
      }
      case "arclytics_tokens": {
        const data = await getTokens(env);
        const items = (data?.items ?? []) as Array<Record<string, unknown>>;
        return clip({
          updatedAt: data?.updatedAt ?? null,
          items: items.slice(0, 15).map((t) => ({
            address: t.address,
            symbol: t.symbol,
            name: t.name,
            price: t.price,
            marketCap: t.marketCap,
            volume24h: t.volume24h,
            holders: t.holders,
          })),
        });
      }
      case "arclytics_wallets": {
        const data = await getWallets(env);
        const items = (data?.items ?? []) as Array<Record<string, unknown>>;
        return clip({
          updatedAt: data?.updatedAt ?? null,
          stats: data?.stats ?? null,
          top: items.slice(0, 10).map((w) => ({
            address: w.address,
            label: w.label,
            netWorth: w.netWorth,
            txs24h: w.txs24h,
          })),
        });
      }
      default:
        return `unknown tool ${name}`;
    }
  } catch (err) {
    return clip({ error: String(err) }, 500);
  }
}
