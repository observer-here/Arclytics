import { Link } from "react-router-dom";
import { addresses } from "@arclytics/chain";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { arcscan } from "@/libs/arcscan";
import { compact } from "@/utils/format";

const STABLES = [
  { address: addresses.usdc, symbol: "USDC" },
  { address: addresses.eurc, symbol: "EURC" },
  { address: addresses.usyc, symbol: "USYC" },
];

export function StablecoinsPage() {
  const { data: rows, loading, error } = useAsyncData("stablecoins", async () => {
    return Promise.all(
      STABLES.map(async (s) => {
        const t = await arcscan.token(s.address).catch(() => null);
        return {
          ...s,
          name: String(t?.name ?? s.symbol),
          holders: Number(t?.holders_count ?? 0),
          iconUrl: t?.icon_url ? String(t.icon_url) : undefined,
        };
      }),
    );
  });

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  const total = (rows ?? []).reduce((s, r) => s + r.holders, 0) || 1;

  return (
    <div className="space-y-2.5">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Holders</th>
              <th className="text-right">Dominance</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.address}>
                <td>
                  <Link
                    to={`/tokens/${r.address}`}
                    className="inline-flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                  >
                    <TokenIcon src={r.iconUrl} symbol={r.symbol} size={22} />
                    <span>
                      {r.symbol}
                      <div className="text-xs font-normal text-ink-400">{r.name}</div>
                    </span>
                  </Link>
                </td>
                <td>{compact(r.holders)}</td>
                <td className="text-right font-medium">{((r.holders / total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
