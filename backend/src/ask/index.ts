import { protocols } from "@arclytics/protocols";
import type { Env } from "../lib/env";
import { tvlSvg } from "./chart";
import { ASK_TOOLS, liveBrief, runAskTool, searchArcDocs } from "./tools";
import { chainTvlSeries, getDetail, getEco } from "../analytics/db";

const ALLOWED = [
  "https://api.openai.com/v1",
  "https://api.groq.com/openai/v1",
  "https://openrouter.ai/api/v1",
];

const PROVIDERS: Record<string, { base: string; model: string }> = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  groq: { base: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile" },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
};

const GROQ_FALLBACKS = ["llama-3.3-70b-versatile", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];

type Msg = { role: string; content?: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string };
type Series = { title: string; data: Array<{ date: string; value: number }> };

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type,authorization,x-ai-key,x-ai-provider",
};

const SYSTEM = `You are Ask Arclytics — the in-app analyst for Arc Testnet (Circle L1, chain 5042002, gas is USDC).

A LIVE SNAPSHOT is already in context. That is ground truth for TVL, volume, fees, protocol rankings, ArcScan tx/address/block counts, RPC head, and top tokens. Answer from it. Do not recap the whole snapshot. Do not invent numbers.

Call a tool only when the snapshot is not enough:
- lookup_token / lookup_address / lookup_tx / search_chain / recent_activity → ArcScan
- rpc_live → chain head / gas / a balance
- arclytics_protocol / arclytics_wallets → extra backend detail
- arc_docs → how Arc works (docs.arc.io). Agentic economy = ERC-8004 + ERC-8183 AI agents, not staking. Circle CEO is Jeremy Allaire; docs do not name a separate Arc CEO.

Write like a person: lead with the answer, then a little context. 1–3 short paragraphs. Name protocols and figures in sentences. No marketing filler. No JSON. No SVG (a chart is attached for you when asked). Docs home: https://docs.arc.io`;

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n) : s;
}

function usdShort(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function wantsChart(q: string) {
  return /\b(tvl|total value locked)\b/i.test(q) && /\b(graph|chart|plot|draw|build)\b/i.test(q);
}

function isHello(q: string) {
  const t = q.trim();
  return /^(hey|hi|hello|yo|sup|thanks)\b/i.test(t) && t.split(/\s+/).length <= 4;
}

async function loadTvlSeries(env: Env, q: string): Promise<Series[]> {
  const lower = q.toLowerCase();
  const hit = protocols.find((p) => lower.includes(p.slug) || lower.includes(p.name.toLowerCase()));
  const out: Series[] = [];
  if (hit) {
    const d = await getDetail(env, hit.slug);
    if (d?.tvlSeries?.some((p) => p.value > 0)) out.push({ title: `${d.protocol.name} TVL`, data: d.tvlSeries });
  }
  const series = await chainTvlSeries(env, 90);
  if (series.some((p) => p.value > 0)) out.push({ title: "Arc TVL", data: series });
  if (!out.length) {
    const eco = (await getEco(env)) as { stats?: { tvlUsd?: number } } | null;
    const total = eco?.stats?.tvlUsd ?? 0;
    if (total > 0) {
      out.push({ title: "Arc TVL", data: [{ date: new Date().toISOString().slice(0, 10), value: total }] });
    }
  }
  return out;
}

function withGraphs(reply: string, series: Series[]) {
  const blocks = series
    .map((s) => tvlSvg(s.title, s.data))
    .filter(Boolean)
    .map((svg) => `\`\`\`svg\n${svg}\n\`\`\``);
  return blocks.length ? `${reply.trim()}\n\n${blocks.join("\n\n")}` : reply;
}

function chartCaption(series: Series[]) {
  const main = series.find((s) => s.title === "Arc TVL") ?? series[0];
  const pts = main?.data ?? [];
  const latest = pts.at(-1)?.value ?? 0;
  const first = pts.find((p) => p.value > 0)?.value ?? 0;
  const pct = first > 0 ? ((latest - first) / first) * 100 : 0;
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.05) return `${main?.title ?? "Arc TVL"} is ${usdShort(latest)}.`;
  return `${main?.title ?? "Arc TVL"} is ${usdShort(latest)}, ${pct >= 0 ? "up" : "down"} ${Math.abs(pct).toFixed(1)}% over the window.`;
}

function dumped(s: string) {
  const t = s.trim();
  return !t || t.startsWith("{") || t.startsWith("[") || /```json|"tvlUsd"|LIVE SNAPSHOT/i.test(t);
}

function scrub(s: string) {
  return s.replace(/```json[\s\S]*?```/gi, "").trim();
}

function isRateLimit(raw: string) {
  return /rate_limit_exceeded|Rate limit reached|tokens per (day|minute)|TPD|TPM|try again in/i.test(raw);
}

function friendlyAiError(raw: string) {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string; code?: string } };
    const msg = j.error?.message || raw;
    if (j.error?.code === "rate_limit_exceeded" || /rate limit/i.test(msg)) {
      return "Groq is busy on this model. Retry — a smaller one should pick up.";
    }
    return msg.slice(0, 280);
  } catch {
    return raw.slice(0, 280);
  }
}

function modelQueue(base: string, preferred: string) {
  if (!base.includes("groq.com")) return [preferred];
  return [preferred, ...GROQ_FALLBACKS.filter((m) => m !== preferred)];
}

async function complete(url: string, key: string, models: string[], messages: Msg[], tools: boolean) {
  let last = "";
  for (const model of models) {
    for (const useTools of tools ? [true, false] : [false]) {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          "http-referer": "https://arclytics.app",
          "x-title": "Arclytics",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.45,
          max_tokens: 1400,
          stream: false,
          ...(useTools ? { tools: ASK_TOOLS, tool_choice: "auto" } : {}),
        }),
      });
      const text = await res.text();
      if (res.ok) {
        return {
          model,
          data: JSON.parse(text) as {
            choices?: Array<{
              message?: {
                role: string;
                content?: string | null;
                tool_calls?: Array<{
                  id: string;
                  type: string;
                  function: { name: string; arguments: string };
                }>;
              };
            }>;
          },
        };
      }
      last = text;
      if (isRateLimit(text) || res.status === 429 || res.status === 404) break;
      throw new Error(friendlyAiError(text));
    }
  }
  throw new Error(friendlyAiError(last || "AI request failed"));
}

export async function handleAsk(req: Request, env: Env): Promise<Response> {
  if (req.method === "GET") {
    return Response.json({ configured: Boolean(env.AI_API_KEY) }, { headers: CORS });
  }

  const body = (await req.json().catch(() => null)) as { messages?: Msg[]; provider?: string } | null;
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

  const chart = wantsChart(lastUser);
  const hello = isHello(lastUser);
  const series = chart ? await loadTvlSeries(env, lastUser) : [];

  const provider = (body?.provider || req.headers.get("x-ai-provider") || "groq").toLowerCase();
  const preset = PROVIDERS[provider] ?? PROVIDERS.groq;
  const base = (env.AI_BASE_URL || preset.base).replace(/\/$/, "");
  if (!ALLOWED.includes(base)) {
    return Response.json({ error: "unsupported AI provider" }, { status: 400, headers: CORS });
  }
  const key = env.AI_API_KEY || req.headers.get("x-ai-key") || "";
  if (!key) {
    if (series.length) return Response.json({ reply: withGraphs(chartCaption(series), series) }, { headers: CORS });
    return Response.json({ error: "Add an API key to chat." }, { status: 401, headers: CORS });
  }

  const url = `${base}/chat/completions`;
  const models = modelQueue(base, env.AI_MODEL || preset.model);
  const messages: Msg[] = [{ role: "system", content: SYSTEM }, ...incoming];

  if (!hello) {
    const [snap, docs] = await Promise.all([
      liveBrief(env).catch(() => ""),
      /what is|how does|agentic|finality|app kit|gas work/i.test(lastUser)
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
    messages.push({ role: "system", content: `A TVL chart will be attached. ${chartCaption(series)}` });
  }

  const finish = (raw: string) => {
    let reply = scrub(raw);
    if (dumped(reply)) reply = series.length ? chartCaption(series) : "I couldn't form an answer. Try again.";
    if (chart && series.length) reply = withGraphs(reply, series);
    return Response.json({ reply }, { headers: CORS });
  };

  try {
    for (let round = 0; round < 3; round++) {
      const { data } = await complete(url, key, models, messages, !hello && round < 2);
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
    const last = await complete(url, key, models, messages, false);
    return finish(last.data.choices?.[0]?.message?.content || "");
  } catch (err) {
    if (chart && series.length) {
      return Response.json({ reply: withGraphs(chartCaption(series), series) }, { headers: CORS });
    }
    return Response.json({ error: String(err).replace(/^Error:\s*/, "").slice(0, 400) }, { status: 502, headers: CORS });
  }
}
