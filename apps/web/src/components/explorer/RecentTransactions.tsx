import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { peekLiveFeed, subscribeLiveFeed } from "@/libs/arcRpc";
import { paths } from "@/routes/paths";
import { shortHash } from "@/utils/format";
import { Skel } from "@/components/shared/Skel";

export function RecentTransactions() {
  const { txs, connected, freshTx } = useSyncExternalStore(
    subscribeLiveFeed,
    peekLiveFeed,
    peekLiveFeed,
  );
  const connecting = !connected && !txs.length;

  return (
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="panel-title">Latest Transactions</div>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
              connected ? "bg-emerald-50 text-emerald-600" : "bg-ink-100 text-ink-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 animate-pulse rounded-full ${connected ? "bg-emerald-500" : "bg-ink-300"}`}
            />
            {connected ? "Live" : "Connecting…"}
          </span>
        </div>
        <Link to={paths.transactions} className="text-[11px] font-medium text-arc-600">
          View all
        </Link>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-ink-400">
            <th className="pb-1 font-medium">Hash</th>
            <th className="pb-1 font-medium">Method</th>
            <th className="pb-1 font-medium">From</th>
            <th className="pb-1 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {txs.map((tx) => (
            <tr
              key={tx.hash}
              className={`border-t border-ink-100 ${freshTx.has(tx.hash) ? "tx-enter" : ""}`}
            >
              <td className="py-1.5 font-mono text-[11px] text-ink-700">
                <span className="sm:hidden">{shortHash(tx.hash, 4, 3)}</span>
                <span className="hidden sm:inline">{shortHash(tx.hash, 8, 6)}</span>
              </td>
              <td className="py-1.5 text-[11px] text-ink-600">{tx.method}</td>
              <td className="py-1.5 font-mono text-[11px] text-ink-500">
                <span className="sm:hidden">{shortHash(tx.from.hash, 4, 3)}</span>
                <span className="hidden sm:inline">{shortHash(tx.from.hash)}</span>
              </td>
              <td className="py-1.5 text-right text-ink-400">
                <TimeAgo ts={tx.timestamp} />
              </td>
            </tr>
          ))}
          {connecting &&
            Array.from({ length: 8 }, (_, i) => (
              <tr key={i} className="border-t border-ink-100">
                <td className="py-1.5" colSpan={4}>
                  <div className="flex items-center gap-2">
                    <Skel className="h-3.5 w-24" />
                    <Skel className="h-3.5 w-16" />
                    <Skel className="h-3.5 flex-1" />
                    <Skel className="h-3.5 w-10" />
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
