import { Link } from "react-router-dom";
import { getProtocol } from "@arclytics/protocols";
import { useAsyncData } from "@/hooks/useAsyncData";
import { arcscan } from "@/libs/arcscan";
import { getProtocolRankings } from "@/libs/dashboard";
import { shortHash, usd } from "@/utils/format";

export function BridgesPage() {
  const { data, loading, error } = useAsyncData("bridges", async () => {
    const cctp = getProtocol("cctp");
    const rankings = await getProtocolRankings().catch(() => []);
    const tvl = rankings.find((r) => r.slug === "cctp");
    const counters = cctp
      ? await Promise.all(
          cctp.contracts.map(async (c) => {
            const row = await arcscan.addressCounters(c.address).catch(() => null);
            return {
              label: c.label ?? c.role,
              address: c.address,
              txs: Number(row?.transactions_count ?? 0),
            };
          }),
        )
      : [];
    return { tvl, counters };
  });

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  const { tvl, counters } = data ?? { tvl: undefined, counters: [] };

  return (
    <div className="space-y-2.5">

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-arc-600">Bridge</div>
            <Link to="/protocols/cctp" className="mt-1 block text-xl font-semibold text-ink-900 hover:text-arc-700">
              Circle CCTP
            </Link>
            <p className="mt-1 text-sm text-ink-500">USDC cross-chain transfer protocol</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-ink-400">Tracked TVL</div>
            <div className="text-2xl font-semibold text-ink-900">{usd(tvl?.tvlUsd ?? 0)}</div>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Address</th>
              <th className="text-right">Transactions</th>
            </tr>
          </thead>
          <tbody>
            {counters.map((c) => (
              <tr key={c.address}>
                <td className="font-medium text-ink-800">{c.label}</td>
                <td className="font-mono text-xs text-ink-500">{shortHash(c.address, 10, 8)}</td>
                <td className="text-right font-medium">{c.txs.toLocaleString("en-US")}</td>
              </tr>
            ))}
            {!counters.length && (
              <tr>
                <td colSpan={3} className="py-8 text-center text-ink-400">
                  No bridge contracts configured.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
