import { Link } from "react-router-dom";
import { addresses } from "@arclytics/chain";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { useAsyncData } from "@/hooks/useAsyncData";
import { arcscan } from "@/libs/arcscan";
import { compact } from "@/utils/format";

const STABLES = [
  { address: addresses.usdc, symbol: "USDC" },
  { address: addresses.eurc, symbol: "EURC" },
  { address: "0x175cdb1d338945f0d851a741ccf787d343e57952" as const, symbol: "USDT" },
  { address: "0x825ae482558415310c71b7e03d2bbbe409345903" as const, symbol: "USYC" },
  { address: "0x911b4000D3422F482F4062a913885f7b035382Df" as const, symbol: "WUSDC" },
];

export function StablecoinsPage() {
  const { data: rows, loading, error } = useAsyncData("stablecoins-v2", async () => {
    return Promise.all(
      STABLES.map(async (s) => {
        const [t, c] = await Promise.all([
          arcscan.token(s.address).catch(() => null),
          arcscan.tokenCounters(s.address).catch(() => null),
        ]);
        return {
          ...s,
          name: String(t?.name ?? s.symbol),
          holders: Number(c?.token_holders_count ?? t?.holders_count ?? 0),
          transfers: Number(c?.transfers_count ?? 0),
          iconUrl: t?.icon_url ? String(t.icon_url) : undefined,
        };
      }),
    );
  });

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  const list = [...(rows ?? [])].sort((a, b) => b.holders - a.holders);
  const total = list.reduce((s, r) => s + r.holders, 0) || 1;

  return (
    <div className="space-y-2.5">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Holders</th>
              <th>Transfers</th>
              <th className="text-right">Dominance</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.address}>
                <td>
                  <Link
                    to={`/tokens/${r.address}`}
                    className="inline-flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                  >
                    <TokenIcon address={r.address} src={r.iconUrl} symbol={r.symbol} size={22} />
                    <span>
                      {r.symbol}
                      <div className="text-xs font-normal text-ink-400">{r.name}</div>
                    </span>
                  </Link>
                </td>
                <td>{compact(r.holders)}</td>
                <td>{r.transfers > 0 ? compact(r.transfers) : "—"}</td>
                <td className="text-right font-medium">{((r.holders / total) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
