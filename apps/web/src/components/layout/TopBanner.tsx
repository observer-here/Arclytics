import { useEffect, useState } from "react";
import { Icons } from "@/components/shared/Icons";

const EVENT_AT = Date.parse("2026-09-16T18:00:00Z");
const WATCH_URL = "https://community.arc.io/public/events/arc-mainnet-launch-livestream";
const DISMISS_KEY = "arclytics:mainnet-banner-dismissed";

function formatCountdown(ms: number) {
  if (ms <= 0) return "Live now";
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const clock = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${clock}` : clock;
}

export function TopBanner() {
  const [visible, setVisible] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const [label, setLabel] = useState(() => formatCountdown(EVENT_AT - Date.now()));

  useEffect(() => {
    if (!visible) return;
    const tick = () => setLabel(formatCountdown(EVENT_AT - Date.now()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <div className="flex h-7 items-center justify-between gap-1.5 border-b border-ink-200/70 bg-[linear-gradient(90deg,#dce8f8_0%,#eef4fb_55%,#e8eef8_100%)] px-2 text-[10px] leading-none dark:border-white/5 dark:bg-[linear-gradient(90deg,#2a2218_0%,#161922_42%,#12151c_100%)] sm:gap-3 sm:px-4 sm:text-[12px]">
      <p className="whitespace-nowrap text-ink-700 dark:text-ink-300">
        <span className="font-semibold text-ink-900 dark:text-white">Arc Mainnet</span>
        <span className="mx-1 text-ink-400 dark:text-ink-500 sm:mx-1.5">·</span>
        <span>Launch livestream</span>
        <span className="mx-1 text-ink-400 dark:text-ink-500 sm:mx-1.5">·</span>
        <span>Sep 16</span>
      </p>

      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
        <span className="font-mono tabular-nums text-ink-600 dark:text-ink-300">{label}</span>
        <a
          href={WATCH_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md bg-ink-900/5 px-1.5 py-0.5 font-medium text-ink-800 transition hover:bg-ink-900/10 dark:bg-white/10 dark:text-ink-100 dark:hover:bg-white/15 sm:px-2"
        >
          Watch
        </a>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss banner"
          className="grid h-5 w-5 place-items-center text-ink-400 transition hover:text-ink-700 dark:text-ink-500 dark:hover:text-ink-200 sm:h-6 sm:w-6"
        >
          <Icons.X size={12} />
        </button>
      </div>
    </div>
  );
}
