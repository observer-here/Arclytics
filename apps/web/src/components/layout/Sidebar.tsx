import { Link, useLocation } from "react-router-dom";
import { Icons } from "@/components/shared/Icons";
import { mainNav, toolsNav } from "@/config/nav";
import { prefetchRoute } from "@/libs/prefetch";
import { paths } from "@/routes/paths";
import { num } from "@/utils/format";

const iconMap = {
  Dashboard: Icons.Dashboard,
  Ecosystem: Icons.Ecosystem,
  DeFi: Icons.DeFi,
  Tokens: Icons.Tokens,
  Stablecoins: Icons.Stablecoins,
  Nfts: Icons.Nfts,
  Bridges: Icons.Bridges,
  Contracts: Icons.Contracts,
  Analytics: Icons.Analytics,
  Rankings: Icons.Rankings,
  Explorer: Icons.Explorer,
  Wallet: Icons.Wallet,
  Compare: Icons.Compare,
  Alerts: Icons.Alerts,
  Watchlist: Icons.Watchlist,
  Settings: Icons.Settings,
} as const;

function Item({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: keyof typeof iconMap;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  const Icon = iconMap[icon];
  return (
    <Link
      to={href}
      onClick={onNavigate}
      onMouseEnter={() => prefetchRoute(href)}
      onFocus={() => prefetchRoute(href)}
      className={`nav-link ${active ? "nav-link-active" : ""}`}
    >
      <span className={`nav-icon ${active ? "nav-icon-active" : ""}`}>
        <Icon size={14} />
      </span>
      {label}
    </Link>
  );
}

export function Sidebar({
  latestBlock,
  avgBlockTime,
  tps,
  onNavigate,
}: {
  latestBlock?: string | number | null;
  avgBlockTime?: number;
  tps?: number;
  onNavigate?: () => void;
}) {
  const blockSecs = avgBlockTime ? avgBlockTime / 1000 : undefined;

  return (
    <aside className="flex h-screen w-[200px] flex-col border-r border-ink-200 bg-white">
      <Link to={paths.home} onClick={onNavigate} className="flex shrink-0 items-center gap-2 px-2.5 py-2.5">
        <img src="/logo.png" alt="Arclytics" className="h-8 w-8 rounded-lg object-contain" />
        <div className="min-w-0 leading-tight">
          <div className="text-[13px] font-semibold text-ink-900">Arclytics</div>
          <div className="text-[10px] text-arc-600">Arc Testnet</div>
        </div>
      </Link>

      <nav className="sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-1.5 pb-2">
        <div className="space-y-1.5">
          {mainNav.map((i) => (
            <Item key={i.href} {...i} onNavigate={onNavigate} />
          ))}
        </div>
        <div>
          <div className="mb-1.5 px-2 text-[10px] font-medium uppercase tracking-wide text-ink-400">
            Tools
          </div>
          <div className="space-y-1.5">
            {toolsNav.map((i) => (
              <Item key={i.href} {...i} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      </nav>

      <div className="shrink-0 m-1.5 rounded-xl border border-ink-200 bg-ink-50 p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[12px] font-medium text-ink-800">Arc Testnet</span>
          <span className="badge-up">Live</span>
        </div>
        <div className="space-y-1 text-[11px] text-ink-500">
          <div className="flex justify-between gap-1">
            <span>Block</span>
            <span className="font-medium text-ink-700">
              {latestBlock != null ? num(Number(latestBlock)) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-1">
            <span>Block Time</span>
            <span className="font-medium text-ink-700">
              {blockSecs != null ? `${blockSecs.toFixed(1)}s` : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-1">
            <span>TPS</span>
            <span className="font-medium text-ink-700">
              {tps != null ? tps.toFixed(1) : "—"}
            </span>
          </div>
          <div className="flex justify-between gap-1">
            <span>Indexer</span>
            <span className="font-medium text-emerald-600">Healthy</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-ink-200 pt-1.5 text-ink-400">
          <a href="https://discord.com" target="_blank" rel="noreferrer" className="hover:text-ink-700" aria-label="Discord">
            <Icons.Discord size={14} />
          </a>
          <a href="https://x.com" target="_blank" rel="noreferrer" className="hover:text-ink-700" aria-label="X">
            <Icons.X size={14} />
          </a>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-ink-700" aria-label="GitHub">
            <Icons.Github size={14} />
          </a>
          <button type="button" className="hover:text-ink-700" aria-label="Theme">
            <Icons.Sun size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}
