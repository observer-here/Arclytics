import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({
  children,
  latestBlock,
  avgBlockTime,
  tps,
}: {
  children: ReactNode;
  latestBlock?: string | number | null;
  avgBlockTime?: number;
  tps?: number;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-ink-50 dark:bg-ink-900">
      {open && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-ink-900/40 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div
        className={`fixed inset-y-0 left-0 z-40 w-[180px] transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar
          latestBlock={latestBlock}
          avgBlockTime={avgBlockTime}
          tps={tps}
          onNavigate={() => setOpen(false)}
        />
      </div>

      <div className="min-w-0 flex-1">
        <Topbar onMenu={() => setOpen(true)} />
        <div className="px-2 py-3 sm:px-2.5">{children}</div>
      </div>
    </div>
  );
}
