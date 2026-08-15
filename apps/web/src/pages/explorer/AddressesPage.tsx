import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ADDR_RE } from "@/config/wallets";
import { paths } from "@/routes/paths";

export function AddressesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  const go = () => {
    const addr = q.trim().toLowerCase();
    if (!ADDR_RE.test(addr)) return;
    navigate(paths.address(addr));
  };

  return (
    <div className="space-y-2.5">
      <div className="card p-4">
        <div className="text-[13px] font-medium text-ink-800">Lookup address</div>
        <p className="mt-1 text-[12px] text-ink-400">
          Paste a wallet or contract address to open its Arclytics profile.
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="0x…"
            className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-3 py-2 font-mono text-[12px] outline-none focus:border-arc-400"
          />
          <button
            type="button"
            onClick={go}
            className="rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 px-3 py-2 text-[12px] font-medium text-white"
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
