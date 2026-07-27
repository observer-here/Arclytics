import { Link } from "react-router-dom";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { compact } from "@/utils/format";

export function TopTokens({
  rows,
}: {
  rows: Array<{
    address: string;
    name: string;
    symbol: string;
    holdersCount: number;
    iconUrl?: string;
  }>;
}) {
  return (
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="panel-title">Top Tokens</div>
        <Link to="/tokens" className="text-[11px] font-medium text-arc-600">
          View all
        </Link>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-ink-400">
            <th className="pb-1 font-medium">Token</th>
            <th className="pb-1 font-medium">Symbol</th>
            <th className="pb-1 text-right font-medium">Holders</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((r) => (
            <tr key={r.address} className="border-t border-ink-100">
              <td className="py-1.5">
                <Link
                  to={`/tokens/${r.address}`}
                  className="flex items-center gap-1.5 font-medium text-ink-800"
                >
                  <TokenIcon src={r.iconUrl} symbol={r.symbol} size={20} />
                  <span className="truncate">{r.name || r.symbol}</span>
                </Link>
              </td>
              <td className="py-1.5 text-ink-500">{r.symbol}</td>
              <td className="py-1.5 text-right font-medium">{compact(r.holdersCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
