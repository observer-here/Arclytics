import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Icons } from "@/components/shared/Icons";
import { paths } from "@/routes/paths";

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-ink-200 bg-white/95 px-3 backdrop-blur sm:px-4">
      <button
        type="button"
        onClick={onMenu}
        className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 bg-white text-ink-700 lg:hidden"
        aria-label="Open menu"
      >
        <Icons.Menu size={15} />
      </button>

      <Link to={paths.home} className="shrink-0 lg:hidden" aria-label="Arclytics home">
        <img src="/logo.png" alt="Arclytics" className="h-7 w-7 rounded-lg object-contain" />
      </Link>

      <form
        className="relative min-w-0 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!q.trim()) return;
          navigate(`${paths.search}?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400">
          <Icons.Search size={14} />
        </span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search protocols, tokens, addresses..."
          autoComplete="off"
          className="w-full rounded-lg border border-ink-200 bg-ink-50 py-1.5 pl-8 pr-10 text-[13px] text-ink-800 outline-none ring-arc-500 placeholder:text-ink-400 focus:bg-white focus:ring-1"
        />
        <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-ink-200 bg-white px-1 py-0.5 text-[9px] text-ink-400 sm:inline">
          ⌘K
        </kbd>
      </form>

      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-2 py-1.5 text-[12px] text-ink-700 sm:inline-flex"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Testnet
          <Icons.Chevron size={12} />
        </button>
        <button
          type="button"
          className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50"
          aria-label="Theme"
        >
          <Icons.Moon size={14} />
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-arc-600 to-indigo-600 px-2.5 py-1.5 text-[12px] font-medium text-white"
        >
          <Icons.Wallet size={13} />
          Connect Wallet
        </button>
      </div>
    </header>
  );
}
