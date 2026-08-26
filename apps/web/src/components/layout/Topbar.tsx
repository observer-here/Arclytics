import { Link } from "react-router-dom";
import { useState } from "react";
import { GlobalSearch } from "@/components/search/GlobalSearch";
import { Icons } from "@/components/shared/Icons";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { loginWithMagic } from "@/libs/auth";
import { paths } from "@/routes/paths";

export function Topbar({ onMenu }: { onMenu?: () => void }) {
  const [busy, setBusy] = useState(false);
  const user = useAuth();
  const { dark, setTheme } = useTheme();

  async function login() {
    if (busy) return;
    setBusy(true);
    try {
      await loginWithMagic();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <header className="flex h-12 items-center gap-2 border-b border-ink-200 bg-white/95 px-3 backdrop-blur dark:border-[var(--line)] dark:bg-[var(--surface-1)] sm:px-4">
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

      <GlobalSearch />

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
          onClick={() => setTheme(dark ? "light" : "dark")}
          className="grid h-8 w-8 place-items-center rounded-lg border border-ink-200 text-ink-600 hover:bg-ink-50"
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Icons.Sun size={14} /> : <Icons.Moon size={14} />}
        </button>
        {user ? (
          <Link
            to={paths.settings}
            className="inline-flex items-center rounded-lg bg-gradient-to-r from-arc-600 to-indigo-600 px-2.5 py-1.5 text-[12px] font-medium text-white"
          >
            {user.username ? `@${user.username}` : "Account"}
          </Link>
        ) : (
          <button
            type="button"
            onClick={login}
            disabled={busy}
            className="inline-flex items-center rounded-lg bg-gradient-to-r from-arc-600 to-indigo-600 px-2.5 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {busy ? "…" : "Login"}
          </button>
        )}
      </div>
    </header>
  );
}
