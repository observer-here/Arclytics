import { useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { peekLiveFeed, subscribeLiveFeed } from "@/libs/arcRpc";
import { paths } from "@/routes/paths";
import { num, shortHash } from "@/utils/format";
import { Skel } from "@/components/shared/Skel";

export function RecentBlocks() {
  const { blocks, live, freshBlock } = useSyncExternalStore(subscribeLiveFeed, peekLiveFeed, peekLiveFeed);

  return (
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="panel-title">Latest Blocks</div>
          <span
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
              live ? "bg-emerald-50 text-emerald-600" : "bg-ink-100 text-ink-400"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-emerald-500" : "bg-ink-300"}`}
            />
            {live ? "Live" : "Connecting…"}
          </span>
        </div>
        <Link to={paths.blocks} className="text-[11px] font-medium text-arc-600">
          View all
        </Link>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] text-ink-400">
            <th className="pb-1 font-medium">Block</th>
            <th className="pb-1 font-medium">Hash</th>
            <th className="pb-1 font-medium">Txns</th>
            <th className="pb-1 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <tr
              key={b.hash || b.number}
              className={`border-t border-ink-100 ${freshBlock.has(b.number) ? "tx-enter" : ""}`}
            >
              <td className="py-1.5 font-medium text-ink-800">#{num(b.number)}</td>
              <td className="py-1.5 font-mono text-[11px] text-ink-500">
                {shortHash(b.hash, 8, 6)}
              </td>
              <td className="py-1.5 text-ink-600">{b.txCount}</td>
              <td className="py-1.5 text-right text-ink-400">
                <TimeAgo ts={b.timestamp} />
              </td>
            </tr>
          ))}
          {!blocks.length &&
            Array.from({ length: 8 }, (_, i) => (
              <tr key={i} className="border-t border-ink-100">
                <td className="py-1.5" colSpan={4}>
                  <div className="flex items-center gap-2">
                    <Skel className="h-3.5 w-16" />
                    <Skel className="h-3.5 w-24" />
                    <Skel className="h-3.5 w-8" />
                    <Skel className="h-3.5 flex-1" />
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
