import { useParams } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { arcscan } from "@/libs/arcscan";
import { compact } from "@/utils/format";

export function TokenDetailPage() {
  const { address = "" } = useParams();
  const { data: token, loading, error } = useAsyncData(
    `token:${address}`,
    () => arcscan.token(address).catch(() => null),
    [address],
  );

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  if (!token) {
    return (
      <div>
        <div className="card p-6 text-ink-500">Token not found.</div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="card p-4">
        <div className="text-lg font-semibold text-ink-900">
          {String(token.name)} ({String(token.symbol)})
        </div>
        <div className="mt-0.5 font-mono text-[11px] text-ink-400">{address}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="text-xs text-ink-400">Holders</div>
          <div className="mt-1 text-xl font-semibold">{compact(Number(token.holders_count ?? 0))}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400">Decimals</div>
          <div className="mt-1 text-xl font-semibold">{String(token.decimals ?? "—")}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-ink-400">Type</div>
          <div className="mt-1 text-xl font-semibold">{String(token.type ?? "ERC-20")}</div>
        </div>
      </div>
    </div>
  );
}
