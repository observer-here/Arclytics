import { API_BASE } from "./api";

export type AskMsg = { role: "user" | "assistant"; content: string };

export function cleanAskError(raw: string) {
  const s = raw.replace(/^Error:\s*/, "").trim();
  try {
    const j = JSON.parse(s) as { error?: { message?: string } | string };
    const msg = typeof j.error === "string" ? j.error : j.error?.message;
    if (!msg) return s;
    if (!/rate limit/i.test(msg)) return msg;
    const wait = msg.match(/try again in ([0-9]+m[0-9.]*s)/i)?.[1];
    return wait ? `Rate limit hit. Try again in ${wait}.` : "Rate limit hit. Try again shortly.";
  } catch {
    return s;
  }
}

export async function askArclytics(messages: AskMsg[], signal?: AbortSignal): Promise<string> {
  const res = await fetch(`${API_BASE}/v1/ask`, {
    method: "POST",
    cache: "no-store",
    signal,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ messages }),
  });
  const data = (await res.json().catch(() => null)) as { reply?: string; error?: string } | null;
  if (!res.ok || data?.error) {
    throw new Error(cleanAskError(data?.error ?? `Ask failed (${res.status})`));
  }
  return data?.reply ?? "";
}
