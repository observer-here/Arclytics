import { useEffect, useRef, useState } from "react";
import { Icons } from "@/components/shared/Icons";
import { askArclytics, type AskMsg } from "@/libs/ask";

const PROMPTS = [
  {
    title: "Chart Arc TVL over 90 days",
    sub: "Plot total value locked across every tracked protocol.",
    q: "Chart Arc TVL over the last 90 days",
    icon: Icons.Analytics,
    tone: "bg-violet-50 text-violet-600",
  },
  {
    title: "Which protocols lead on TVL?",
    sub: "Rank the ecosystem by live TVL, volume, and fees.",
    q: "Which protocols lead on TVL right now, and how much volume are they doing?",
    icon: Icons.Tvl,
    tone: "bg-indigo-50 text-indigo-600",
  },
  {
    title: "How do gas and finality work on Arc?",
    sub: "USDC as gas, the 20 Gwei floor, sub-second finality.",
    q: "How do gas fees and finality work on Arc?",
    icon: Icons.Blocks,
    tone: "bg-sky-50 text-sky-600",
  },
  {
    title: "Who holds the most USDC?",
    sub: "Top holders of the native gas token, straight from ArcScan.",
    q: "Who are the biggest USDC holders on Arc?",
    icon: Icons.Users,
    tone: "bg-orange-50 text-orange-600",
  },
  {
    title: "Has volume grown this month?",
    sub: "Trend 24h volume across the ecosystem from stored history.",
    q: "How has trading volume trended over the past month?",
    icon: Icons.Activity,
    tone: "bg-emerald-50 text-emerald-600",
  },
];

const CHIPS = [
  { label: "Network now", q: "What's live TVL, 24h volume, and transaction count on Arc?", icon: Icons.Tvl },
  { label: "Recent activity", q: "What's happening on Arc right now — latest blocks and transactions?", icon: Icons.Tx },
  { label: "Whale wallets", q: "Show me the biggest wallets on Arc and what they hold", icon: Icons.Wallet },
  { label: "Bridging", q: "How does bridging USDC to Arc work?", icon: Icons.Users },
];

function inline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-ink-900">
          {p.slice(2, -2)}
        </strong>
      );
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return (
        <code key={i} className="rounded bg-ink-100 px-1 text-[12px]">
          {p.slice(1, -1)}
        </code>
      );
    }
    return p;
  });
}

function safeSvg(raw: string) {
  const svg = raw.trim();
  if (!svg.startsWith("<svg") || /<script|on\w+=/i.test(svg)) return "";
  return svg;
}

function Answer({ text }: { text: string }) {
  const chunks = text.split(/```svg\n?([\s\S]*?)```/g);
  return (
    <div className="space-y-2.5">
      {chunks.map((chunk, i) => {
        if (i % 2 === 1) {
          const svg = safeSvg(chunk);
          if (!svg) return null;
          return <div key={i} className="max-w-full" dangerouslySetInnerHTML={{ __html: svg }} />;
        }
        const blocks = chunk.trim() ? chunk.trim().split(/\n{2,}/) : [];
        return blocks.map((block, j) => {
          const lines = block.split("\n");
          if (lines.every((l) => /^\s*[-*]\s/.test(l))) {
            return (
              <ul key={`${i}-${j}`} className="list-disc space-y-1 pl-4">
                {lines.map((l, k) => (
                  <li key={k}>{inline(l.replace(/^\s*[-*]\s/, ""))}</li>
                ))}
              </ul>
            );
          }
          const h = block.match(/^(#{1,3})\s+([\s\S]+)/);
          if (h) {
            const cls = h[1].length === 1 ? "text-[15px] font-semibold" : "text-[13px] font-semibold";
            return (
              <div key={`${i}-${j}`} className={`${cls} text-ink-900`}>
                {inline(h[2])}
              </div>
            );
          }
          return (
            <p key={`${i}-${j}`} className="whitespace-pre-wrap">
              {inline(block)}
            </p>
          );
        });
      })}
    </div>
  );
}

export function AskPage() {
  const [msgs, setMsgs] = useState<AskMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const row = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setErr(null);
    setInput("");
    const next: AskMsg[] = [...msgs, { role: "user", content: q }];
    setMsgs([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    abort.current?.abort();
    abort.current = new AbortController();
    try {
      const reply = await askArclytics(next, abort.current.signal);
      setMsgs((cur) => {
        const copy = [...cur];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: reply };
        return copy;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ask failed";
      setErr(msg);
      setMsgs((cur) => {
        const copy = [...cur];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && !last.content) copy.pop();
        return copy;
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4.5rem)] w-full flex-col">
      <div ref={box} className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        {!msgs.length ? (
          <div className="flex min-h-full flex-col items-center justify-center px-2 pb-6 pt-8 text-center">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
              <span className="relative">
                <Icons.Ask size={22} />
                <span className="absolute -right-1.5 -top-1.5 text-white">
                  <Icons.Sparkles size={11} />
                </span>
              </span>
            </div>
            <h1 className="mt-4 text-[26px] font-semibold tracking-tight text-ink-900">Ask Arclytics</h1>
            <p className="mt-1.5 max-w-md text-[13px] text-ink-400">
              Ask anything about Arc Testnet data and get instant, AI-powered insights.
            </p>
            <div className="mt-3.5 flex flex-wrap justify-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-600">
                <span className="text-violet-500">
                  <Icons.Activity size={12} />
                </span>
                Live on-chain data
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-600">
                <span className="text-emerald-500">
                  <Icons.Verified size={12} />
                </span>
                Verified sources
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-600">
                <span className="text-sky-500">
                  <Icons.Sparkles size={12} />
                </span>
                Powered by Arclytics AI
              </span>
            </div>
            <div className="relative mt-8 w-full">
              <div
                ref={row}
                className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {PROMPTS.map((p) => (
                  <button
                    key={p.title}
                    type="button"
                    onClick={() => send(p.q)}
                    className="min-w-[200px] flex-1 rounded-2xl border border-ink-200 bg-white p-3.5 text-left shadow-sm transition hover:border-violet-300 hover:shadow"
                  >
                    <span className={`grid h-8 w-8 place-items-center rounded-lg ${p.tone}`}>
                      <p.icon size={15} />
                    </span>
                    <div className="mt-3 text-[13px] font-semibold leading-snug text-ink-900">{p.title}</div>
                    <div className="mt-1 text-[12px] leading-snug text-ink-400">{p.sub}</div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-label="More prompts"
                onClick={() => row.current?.scrollBy({ left: 230, behavior: "smooth" })}
                className="absolute -right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-ink-200 bg-white text-ink-500 shadow-sm hover:text-ink-800"
              >
                <Icons.Chevron size={14} className="-rotate-90" />
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 px-1 py-3">
            {msgs.map((m, i) => (
              <div
                key={`${m.role}-${i}`}
                className={`text-[13.5px] leading-[1.65] ${
                  m.role === "user"
                    ? "ml-auto max-w-[80%] rounded-2xl bg-violet-600 px-3 py-2 text-white whitespace-pre-wrap"
                    : "w-full max-w-none text-ink-800"
                }`}
              >
                {m.role === "assistant" ? (
                  m.content ? (
                    <Answer text={m.content} />
                  ) : busy && i === msgs.length - 1 ? (
                    "Looking up live data…"
                  ) : (
                    ""
                  )
                ) : (
                  m.content
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {err && <div className="px-1 pb-1 text-[11px] text-rose-600">{err}</div>}

      <form
        className="px-1 pb-1"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="rounded-2xl border border-ink-200 bg-white p-2.5 shadow-sm">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ask anything about Arc Testnet..."
              className="min-h-[36px] max-h-28 flex-1 resize-none bg-transparent py-2 text-[13px] outline-none placeholder:text-ink-400"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-600 text-white disabled:opacity-40"
              aria-label="Send"
            >
              <Icons.Send size={14} />
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5 pl-1">
            {CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => send(c.q)}
                className="inline-flex items-center gap-1 rounded-full border border-ink-200 bg-white px-2.5 py-1 text-[11px] text-ink-600 hover:border-violet-300 hover:text-violet-700"
              >
                <c.icon size={11} />
                {c.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-400">
          AI can make mistakes. Always verify important data on-chain.
        </p>
      </form>
    </div>
  );
}
