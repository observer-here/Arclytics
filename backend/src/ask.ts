import { protocols } from "@arclytics/protocols";
import type { Env } from "./env";
import { tvlSvg } from "./askChart";
import { ASK_TOOLS, runAskTool } from "./askTools";
import { chainTvlSeries, getDetail, getEco } from "./db";

const ALLOWED = [
  "https://api.openai.com/v1",
  "https://api.groq.com/openai/v1",
  "https://openrouter.ai/api/v1",
];

const PROVIDERS: Record<string, { base: string; model: string }> = {
  openai: { base: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  groq: { base: "https://api.groq.com/openai/v1", model: "llama-3.1-8b-instant" },
  openrouter: { base: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini" },
};

const GROQ_FALLBACKS = ["llama-3.1-8b-instant", "openai/gpt-oss-20b"];

type Msg = { role: string; content?: string | null; tool_calls?: unknown; tool_call_id?: string; name?: string };
type Series = { title: string; data: Array<{ date: string; value: number }> };

function clip(s: string, n: number) {
  return s.length > n ? s.slice(0, n) : s;
}

const SYSTEM = `You are Ask Arclytics, a conversational analyst for Arc Testnet (chain 5042002, native gas is USDC).
Talk like ChatGPT / Grok: warm, clear, full paragraphs. Use markdown. Never paste raw JSON.
Known facts (no tools): Arc public testnet launched October 28, 2025 (Circle). Chain ID 5042002. Gas is USDC.
For live TVL / txs / balances / holders / gas / blocks / rankings you MUST call tools. Never invent numbers.
When the user wants a TVL graph or chart, call arclytics_tvl (and arclytics_protocol if they named a protocol). Do not draw ASCII art. Do not output SVG — a graph is built from the tool data and attached for you. Write the analysis only.
totalAddresses ≠ totalAccounts.`;

function usdShort(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function wantsTvlChart(q: string) {
  const t = q.trim();
  if (/\b(tvl|total value locked)\b/i.test(t) && /\b(graph|chart|plot|draw|build|show)\b/i.test(t)) return true;
  return /^(show |draw |build )?(the )?(tvl|total value locked)\b/i.test(t);
}

async function loadTvlSeries(env: Env, q: string): Promise<Series[]> {
  const lower = q.toLowerCase();
  const hit = protocols.find((p) => lower.includes(p.slug) || lower.includes(p.name.toLowerCase()));
  const out: Series[] = [];
  if (hit) {
    const d = await getDetail(env, hit.slug);
    if (d?.tvlSeries?.some((p) => p.value > 0)) {
      out.push({ title: `${d.protocol.name} TVL`, data: d.tvlSeries });
    }
  }
  const series = await chainTvlSeries(env, 90);
  if (series.some((p) => p.value > 0)) out.push({ title: "Arc TVL", data: series });
  if (!out.length) {
    const eco = (await getEco(env)) as { stats?: { tvlUsd?: number } } | null;
    const total = eco?.stats?.tvlUsd ?? 0;
    if (total > 0) {
      out.push({
        title: "Arc TVL",
        data: [{ date: new Date().toISOString().slice(0, 10), value: total }],
      });
    }
  }
  return out;
}

function withGraphs(reply: string, series: Series[]) {
  const blocks = series
    .map((s) => tvlSvg(s.title, s.data))
    .filter(Boolean)
    .map((svg) => `\`\`\`svg\n${svg}\n\`\`\``);
  if (!blocks.length) return reply;
  return `${reply.trim()}\n\n${blocks.join("\n\n")}`;
}

function seriesBlurb(series: Series[]) {
  const main = series.find((s) => s.title === "Arc TVL") ?? series[0];
  const pts = main?.data ?? [];
  const latest = pts.at(-1)?.value ?? 0;
  const first = pts.find((p) => p.value > 0)?.value ?? 0;
  const pct = first > 0 ? ((latest - first) / first) * 100 : 0;
  return `**${main?.title ?? "Arc TVL"}** is **${usdShort(latest)}** from live Arclytics backend snapshots. Over this window it is ${pct >= 0 ? "up" : "down"} **${Math.abs(pct).toFixed(1)}%**.`;
}

function friendlyAiError(raw: string) {
  try {
    const j = JSON.parse(raw) as { error?: { message?: string; code?: string } };
    const msg = j.error?.message || raw;
    if (j.error?.code === "rate_limit_exceeded" || /rate limit/i.test(msg)) {
      const wait = msg.match(/try again in ([0-9m.]+s)/i)?.[1];
      return wait ? `Groq limit hit. Try again in ${wait}.` : "Groq rate limit hit. Try again in a minute.";
    }
    return msg.slice(0, 280);
  } catch {
    return raw.slice(0, 280);
  }
}

function isRateLimit(raw: string) {
  return /rate_limit_exceeded|Rate limit reached|tokens per (day|minute)|TPD|TPM/i.test(raw);
}

function modelQueue(base: string, preferred: string) {
  if (!base.includes("groq.com")) return [preferred];
  const extra = GROQ_FALLBACKS.filter((m) => m !== preferred);
  return [preferred, ...extra];
}

async function complete(
  url: string,
  key: string,
  models: string[],
  messages: Msg[],
  tools: boolean,
) {
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
          temperature: 0.55,
          max_tokens: 2048,
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
      if (isRateLimit(text) || res.status === 429) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      if (res.status === 404 || /model_not_found|does not exist|invalid_model/i.test(text)) break;
      throw new Error(friendlyAiError(text));
    }
  }
  throw new Error(friendlyAiError(last || "AI request failed"));
}

export async function handleAsk(req: Request, env: Env): Promise<Response> {
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "content-type,authorization,x-ai-key,x-ai-provider",
  };

  if (req.method === "GET") {
    return Response.json({ configured: Boolean(env.AI_API_KEY) }, { headers });
  }

  const body = (await req.json().catch(() => null)) as { messages?: Msg[]; provider?: string } | null;
  const incoming = (body?.messages ?? [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: clip(String(m.content ?? ""), 4000) }));
  if (!incoming.length) {
    return Response.json({ error: "messages required" }, { status: 400, headers });
  }

  const lastUser = [...incoming].reverse().find((m) => m.role === "user")?.content ?? "";
  const graphAsk = wantsTvlChart(lastUser);
  let series: Series[] = graphAsk ? await loadTvlSeries(env, lastUser) : [];

  const provider = (body?.provider || req.headers.get("x-ai-provider") || "groq").toLowerCase();
  const preset = PROVIDERS[provider] ?? PROVIDERS.groq;
  const base = (env.AI_BASE_URL || preset.base).replace(/\/$/, "");
  if (!ALLOWED.includes(base)) {
    return Response.json({ error: "unsupported AI provider" }, { status: 400, headers });
  }
  const key = env.AI_API_KEY || req.headers.get("x-ai-key") || "";
  if (!key) {
    if (series.length) return Response.json({ reply: withGraphs(seriesBlurb(series), series) }, { headers });
    return Response.json({ error: "Add an API key to chat." }, { status: 401, headers });
  }

  const url = `${base}/chat/completions`;
  const models = modelQueue(base, env.AI_MODEL || preset.model);
  const messages: Msg[] = [{ role: "system", content: SYSTEM }, ...incoming];
  if (series.length) {
    const main = series[0];
    const sample = main.data.filter((_, i) => i % 3 === 0 || i === main.data.length - 1);
    messages.push({
      role: "system",
      content: `Live Arclytics backend TVL for "${main.title}" (${main.data.length} days). Points: ${clip(JSON.stringify(sample), 2500)}. Latest ${usdShort(main.data.at(-1)?.value ?? 0)}. Write a full analysis from these numbers. Do not output SVG or JSON.`,
    });
  }

  try {
    for (let round = 0; round < 4; round++) {
      const { data } = await complete(url, key, models, messages, round < 3 && !series.length);
      const msg = data.choices?.[0]?.message;
      if (!msg) throw new Error("empty AI response");
      const calls = msg.tool_calls ?? [];
      if (!calls.length) {
        let reply = msg.content || "";
        if (/\btvl\b/i.test(lastUser) && !series.length) {
          series = await loadTvlSeries(env, lastUser).catch(() => []);
        }
        if (series.length) reply = withGraphs(reply || seriesBlurb(series), series);
        return Response.json({ reply }, { headers });
      }
      messages.push(msg);
      const results = await Promise.all(
        calls.map(async (c) => ({
          role: "tool" as const,
          tool_call_id: c.id,
          content: await runAskTool(env, c.function.name, c.function.arguments || "{}"),
        })),
      );
      messages.push(...results);
      if (calls.some((c) => c.function.name === "arclytics_tvl" || c.function.name === "arclytics_protocol") && !series.length) {
        series = await loadTvlSeries(env, lastUser).catch(() => series);
      }
    }
    const last = await complete(url, key, models, messages, false);
    let reply = last.data.choices?.[0]?.message?.content || "";
    if (series.length) reply = withGraphs(reply || seriesBlurb(series), series);
    return Response.json({ reply }, { headers });
  } catch (err) {
    if (!series.length && /\btvl\b/i.test(lastUser)) {
      series = await loadTvlSeries(env, lastUser).catch(() => []);
    }
    if (series.length) {
      return Response.json({ reply: withGraphs(seriesBlurb(series), series) }, { headers });
    }
    return Response.json({ error: String(err).replace(/^Error:\s*/, "").slice(0, 400) }, { status: 502, headers });
  }
}
