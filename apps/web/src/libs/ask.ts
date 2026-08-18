import { API_BASE } from "./api";

export type AskMsg = { role: "user" | "assistant"; content: string };

export function cleanAskError(raw: string) {
  const s = raw.replace(/^Error:\s*/, "").trim();
  try {
    const j = JSON.parse(s) as { error?: { message?: string } | string };
    const msg = typeof j.error === "string" ? j.error : j.error?.message;
    if (msg) {
      if (/rate limit/i.test(msg)) {
        const wait = msg.match(/try again in ([0-9]+m[0-9.]*s)/i)?.[1];
        return wait ? `Groq limit hit. Try again in ${wait}.` : "Groq rate limit hit. Try again shortly.";
      }
      return msg;
    }
  } catch {
    /* raw */
  }
  return s;
}

export async function streamAsk(
  messages: AskMsg[],
  onDelta: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE}/v1/ask`, {
    method: "POST",
    cache: "no-store",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let msg = body;
    try {
      msg = String((JSON.parse(body) as { error?: string }).error ?? body);
    } catch {
      /* raw */
    }
    throw new Error(cleanAskError(msg || `Ask failed (${res.status})`));
  }

  const ctype = res.headers.get("content-type") ?? "";
  if (!ctype.includes("event-stream") || !res.body) {
    const data = (await res.json()) as { reply?: string; error?: string };
    if (data.error) throw new Error(cleanAskError(data.error));
    if (data.reply) onDelta(data.reply);
    return;
  }

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const row = line.trim();
      if (!row.startsWith("data:")) continue;
      const payload = row.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const json = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const bit = json.choices?.[0]?.delta?.content;
        if (bit) onDelta(bit);
      } catch {
        /* skip */
      }
    }
  }
}
