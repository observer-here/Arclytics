import { addresses } from "@arclytics/chain";
import { protocols } from "@arclytics/protocols";
import type { Env } from "../lib/env";
import { axisLabel, metricSvg, type Axis } from "./chart";
import { ASK_TOOLS, liveBrief, matchSubject, runAskTool, searchArcDocs } from "./tools";
import { chainTvlSeries, getEco, seriesFor, tokenSeriesFor } from "../analytics/db";

const AI_URL = "https://api.groq.com/openai/v1/chat/completions";
const AI_MODEL = "openai/gpt-oss-120b";

type Msg = { role: string; content?: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string };
type Series = { title: string; axis: Axis; data: Array<{ date: string; value: number }> };
type AiReply = {
  choices?: Array<{
    message?: {
      role: string;
      content?: string | null;
      tool_calls?: Array<{ id: string; type: string; function: { name: string; arguments: string } }>;
    };
  }>;
};

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization",
};

const SYSTEM = `You are Ask Arclytics, the analyst built into Arclytics — an analytics app for Arc Testnet covering protocol TVL, tokens, wallets, and network activity.

ARC FACTS (from docs.arc.io — trust these over your own recollection)
Arc is Circle's purpose-built Layer 1 for stablecoin finance. Chain id 5042002, testnet only — mainnet contract addresses do not exist yet. USDC is the native gas token at ${addresses.usdc}; native gas accounting uses 18 decimals while the ERC-20 interface uses 6, and they share one balance. Blocks land in about 0.48s with deterministic finality, so a single confirmation is final and there are no reorgs. Fees use EIP-1559 with EWMA smoothing: the base fee targets roughly $0.01 per transaction, the floor is 20 Gwei, the ceiling is 20,000 Gwei, and each block carries 30M gas. Arc is fully EVM compatible. Testnet USDC and EURC come from faucet.circle.com; the explorer is testnet.arcscan.app. Crosschain moves run over CCTP (Arc is domain 26, TokenMessengerV2 ${addresses.cctp.tokenMessengerV2}) and Circle Gateway (wallet ${addresses.gateway.wallet}); the SDK for this is Circle App Kit, published as @circle-fin/app-kit with bridge, swap, send, and unified-balance capabilities. Arc predeploys a Memo contract at 0x5294E9927c3306DcBaDb03fe70b92e01cCede505 and Multicall3From at 0x522fAf9A91c41c443c66765030741e4AaCe147D0. "Agentic economy" on Arc means ERC-8004 agent identity plus ERC-8183 job and escrow settlement — it never means staking or yield farming. Circle's CEO is Jeremy Allaire; the docs name no separate Arc CEO.

DATA RULES
A LIVE SNAPSHOT is prepended to this conversation. Treat it as ground truth for TVL, 24h volume, fees, active users, protocol rankings, top tokens, ArcScan totals, and the chain head. Answer from it, never paste it back wholesale, and never invent a figure. Arclytics tracks ${protocols.length} protocols and a curated token set on Arc Testnet only.

TOOLS — reach for one only when the snapshot falls short
arclytics_find resolves a name to a slug or address; run it first when the user names something you need an id for.
arclytics_protocol and arclytics_token give depth on a single protocol or token.
arclytics_series answers "how has this moved" with real history.
arclytics_wallets covers whales and large holders.
lookup_address, lookup_token, lookup_tx, and search_chain handle any raw 0x address, hash, or contract Arclytics does not track.
recent_activity and rpc_live report what is happening this minute.
arc_docs explains how Arc itself works; cite the docs URL when you lean on it.

WHERE THINGS LIVE IN THE APP — offer these as plain paths when they help
/ for the dashboard, /ecosystem for the protocol leaderboard, /protocols/{slug}, /tokens and /tokens/{address}, /tokens/market-cap, /nfts, /analytics for charts and flows, /explorer and /explorer/blocks, /address/{address}, /tools/wallet, /tools/compare, /tools/watchlist, /contracts, /settings.

STYLE
Lead with the answer, then the context that makes it useful. One to three short paragraphs of full sentences with the figures named inline. Flag thin or missing data instead of papering over it. No headings, no bulleted dumps, no JSON, no SVG — charts are attached for you. Keep units explicit: on-chain amounts in USDC, valuations in $.`;

const TOKEN_METRICS = ["price", "mcap", "holders"] as const;
const LABEL: Record<Metric, string> = {
  tvl: "TVL",
  volume: "24h volume",
  fees: "fees",
  users: "active users",
  price: "price",
  mcap: "market cap",
  holders: "holders",
};

type Metric = "tvl" | "volume" | "fees" | "users" | "price" | "mcap" | "holders";
type ChartAsk = { metric: Metric; days: number };

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n) : s;
}

function chartAsk(q: string): ChartAsk | null {
  if (!/\b(graph|chart|plot|draw|visuali[sz]e|trend)\b/i.test(q)) return null;
  const metric: Metric = /\bprice\b/i.test(q)
    ? "price"
    : /\b(market ?cap|mcap)\b/i.test(q)
      ? "mcap"
      : /\bholders?\b/i.test(q)
        ? "holders"
        : /\bvol(ume)?\b/i.test(q)
          ? "volume"
          : /\bfees?\b/i.test(q)
            ? "fees"
            : /\b(users|active)\b/i.test(q)
              ? "users"
              : "tvl";
  const span = q.match(/\b(\d{1,3})\s*(d|days?|w|weeks?|m|months?)\b/i);
  let days = 90;
  if (span) {
    const n = Number(span[1]);
    const unit = span[2].toLowerCase()[0];
    days = unit === "w" ? n * 7 : unit === "m" ? n * 30 : n;
  } else if (/\byear\b/i.test(q)) days = 365;
  else if (/\bmonth\b/i.test(q)) days = 30;
  else if (/\bweek\b/i.test(q)) days = 7;
  return { metric, days: Math.min(365, Math.max(7, days)) };
}

function isHello(q: string) {
  const t = q.trim();
  return /^(hey|hi|hello|yo|sup|thanks)\b/i.test(t) && t.split(/\s+/).length <= 4;
}

function axisFor(metric: Metric): Axis {
  if (metric === "price") return "price";
  if (metric === "users" || metric === "holders") return "count";
  return "usd";
}

async function loadChart(env: Env, q: string, ask: ChartAsk): Promise<Series[]> {
  const { metric, days } = ask;
  const axis = axisFor(metric);
  const subject = await matchSubject(env, q);
  const live = (data: Array<{ date: string; value: number }>) => data.some((p) => p.value > 0);

  if ((TOKEN_METRICS as readonly string[]).includes(metric)) {
    if (subject?.kind !== "token") return [];
    const data = await tokenSeriesFor(env, subject.address, metric as "price" | "mcap" | "holders", days);
    return live(data) ? [{ title: `${subject.symbol} ${LABEL[metric]}`, axis, data }] : [];
  }

  if (subject?.kind === "protocol") {
    const data = await seriesFor(env, subject.slug, metric as "tvl" | "volume" | "fees" | "users", days);
    if (live(data)) return [{ title: `${subject.name} ${LABEL[metric]}`, axis, data }];
  }
  if (metric !== "tvl") return [];

  const chain = await chainTvlSeries(env, days);
  if (live(chain)) return [{ title: "Arc TVL", axis, data: chain }];
  const eco = (await getEco(env)) as { stats?: { tvlUsd?: number } } | null;
  const total = eco?.stats?.tvlUsd ?? 0;
  if (!total) return [];
  return [{ title: "Arc TVL", axis, data: [{ date: new Date().toISOString().slice(0, 10), value: total }] }];
}

function withGraphs(reply: string, series: Series[]) {
  const blocks = series
    .map((s) => metricSvg(s.title, s.data, s.axis))
    .filter(Boolean)
    .map((svg) => `\`\`\`svg\n${svg}\n\`\`\``);
  return blocks.length ? `${reply.trim()}\n\n${blocks.join("\n\n")}` : reply;
}

function chartCaption(series: Series[]) {
  const main = series[0];
  const pts = main?.data ?? [];
  const latest = pts.at(-1)?.value ?? 0;
  const first = pts.find((p) => p.value > 0)?.value ?? 0;
  const now = axisLabel(latest, main?.axis ?? "usd");
  const pct = first > 0 ? ((latest - first) / first) * 100 : 0;
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) return `${main?.title ?? "Arc TVL"} is ${now}.`;
  return `${main?.title ?? "Arc TVL"} is ${now}, ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% over the window.`;
}

function dumped(s: string) {
  const t = s.trim();
  return !t || t.startsWith("{") || t.startsWith("[") || /```json|"tvlUsd"|LIVE SNAPSHOT/i.test(t);
}

function scrub(s: string) {
  return s.replace(/```json[\s\S]*?```/gi, "").trim();
}

function friendlyAiError(raw: string) {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string; code?: string } };
    const msg = j.error?.message || raw;
    if (j.error?.code === "rate_limit_exceeded" || /rate limit/i.test(msg)) {
      return "Rate limit reached. Try again shortly.";
    }
    return msg.slice(0, 280);
  } catch {
    return raw.slice(0, 280);
  }
}

async function complete(key: string, messages: Msg[], tools: boolean): Promise<AiReply> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      temperature: 0.45,
      max_tokens: 1400,
      ...(tools ? { tools: ASK_TOOLS, tool_choice: "auto" } : {}),
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(friendlyAiError(text));
  return JSON.parse(text) as AiReply;
}

export async function handleAsk(req: Request, env: Env): Promise<Response> {
  if (req.method === "GET") {
    return Response.json({ configured: Boolean(env.AI_API_KEY) }, { headers: CORS });
  }

  const body = (await req.json().catch(() => null)) as { messages?: Msg[] } | null;
  const incoming = (body?.messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-8)
    .map((m) => ({ role: m.role, content: clip(String(m.content ?? ""), 3000) }));
  if (!incoming.length) {
    return Response.json({ error: "messages required" }, { status: 400, headers: CORS });
  }

  const lastUser = [...incoming].reverse().find((m) => m.role === "user")?.content ?? "";
  if (/^(arc\s+)?docs(\s+link|\s+url)?\??$/i.test(lastUser.trim())) {
    return Response.json(
      { reply: "Official Arc docs: https://docs.arc.io\nAgent index: https://docs.arc.io/llms.txt" },
      { headers: CORS },
    );
  }

  const ask = chartAsk(lastUser);
  const hello = isHello(lastUser);
  const series = ask ? await loadChart(env, lastUser, ask) : [];

  const key = env.AI_API_KEY || "";
  if (!key) {
    if (series.length) return Response.json({ reply: withGraphs(chartCaption(series), series) }, { headers: CORS });
    return Response.json({ error: "Ask Arclytics is not configured." }, { status: 503, headers: CORS });
  }

  const messages: Msg[] = [{ role: "system", content: SYSTEM }, ...incoming];

  if (!hello) {
    const [snap, docs] = await Promise.all([
      liveBrief(env).catch(() => ""),
      /what is|how does|how do|why |agentic|finality|app kit|gas|fee|faucet|decimal|deploy|bridge|cctp|erc-8|memo|multicall|rpc/i.test(
        lastUser,
      )
        ? searchArcDocs(lastUser).catch(() => "")
        : Promise.resolve(""),
    ]);
    if (snap) {
      messages.push({
        role: "system",
        content: `LIVE SNAPSHOT (ground truth — answer from this, do not paste it):\n${snap}`,
      });
    }
    if (docs) {
      messages.push({ role: "system", content: `DOCS EXCERPT:\n${clip(docs, 2800)}` });
    }
  }
  if (series.length) {
    messages.push({ role: "system", content: `A chart will be attached below your answer. ${chartCaption(series)}` });
  }

  const finish = (raw: string) => {
    let reply = scrub(raw);
    if (dumped(reply)) reply = series.length ? chartCaption(series) : "I couldn't form an answer. Try again.";
    if (series.length) reply = withGraphs(reply, series);
    return Response.json({ reply }, { headers: CORS });
  };

  try {
    for (let round = 0; round < 3; round++) {
      const data = await complete(key, messages, !hello && round < 2);
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("empty AI response");
      const calls = msg.tool_calls ?? [];
      if (!calls.length) return finish(msg.content || "");
      messages.push(msg);
      messages.push(
        ...(await Promise.all(
          calls.map(async (c) => ({
            role: "tool" as const,
            tool_call_id: c.id,
            content: await runAskTool(env, c.function.name, c.function.arguments || "{}"),
          })),
        )),
      );
    }
    const last = await complete(key, messages, false);
    return finish(last.choices?.[0]?.message?.content || "");
  } catch (err) {
    if (series.length) {
      return Response.json({ reply: withGraphs(chartCaption(series), series) }, { headers: CORS });
    }
    return Response.json({ error: String(err).replace(/^Error:\s*/, "").slice(0, 400) }, { status: 502, headers: CORS });
  }
}
