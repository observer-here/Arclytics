import { Link } from "react-router-dom";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { compact } from "@/utils/format";

export function StablecoinsTable({
  rows,
}: {
  rows: Array<{
    address: string;
    name: string;
    symbol: string;
    holders: number;
    iconUrl?: string;
  }>;
}) {
  const total = rows.reduce((s, r) => s + r.holders, 0) || 1;

  return (
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="panel-title">Stablecoins Overview</div>
        <Link to="/stablecoins" className="text-[11px] font-medium text-arc-600">
          View all
        </Link>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-ink-400">
            <th className="pb-1 font-medium">Asset</th>
            <th className="pb-1 font-medium">Holders</th>
            <th className="pb-1 text-right font-medium">Dominance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.address} className="border-t border-ink-100">
              <td className="py-1.5">
                <Link
                  to={`/tokens/${r.address}`}
                  className="inline-flex items-center gap-1.5 font-medium text-ink-800"
                >
                  <TokenIcon src={r.iconUrl} symbol={r.symbol} size={18} />
                  <span>
                    {r.symbol}
                    <div className="text-[10px] font-normal text-ink-400">{r.name}</div>
                  </span>
                </Link>
              </td>
              <td className="py-1.5">{compact(r.holders)}</td>
              <td className="py-1.5 text-right font-medium">
                {((r.holders / total) * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
