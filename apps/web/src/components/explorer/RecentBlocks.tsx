import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TimeAgo } from "@/components/shared/TimeAgo";
import {
  fetchLatestRpcBlocks,
  subscribeRpcBlocks,
  type LiveBlock,
} from "@/libs/arcRpc";
import { paths } from "@/routes/paths";
import { num, shortHash } from "@/utils/format";

const LIMIT = 12;

export function RecentBlocks() {
  const [blocks, setBlocks] = useState<LiveBlock[]>([]);
  const [fresh, setFresh] = useState<Set<number>>(() => new Set());
  const [live, setLive] = useState(false);
  const seen = useRef(new Set<number>());

  useEffect(() => {
    let alive = true;

    const markFresh = (nums: number[]) => {
      if (!nums.length) return;
      const next = new Set(nums);
      setFresh(next);
      window.setTimeout(() => {
        if (!alive) return;
        setFresh((cur) => {
          const copy = new Set(cur);
          for (const n of next) copy.delete(n);
          return copy;
        });
      }, 900);
    };

    const bootstrap = async () => {
      try {
        const latest = await fetchLatestRpcBlocks(LIMIT);
        if (!alive) return;
        seen.current = new Set(latest.map((b) => b.number));
        setBlocks(latest);
        setLive(true);
      } catch {
        if (alive) setLive(false);
      }
    };

    void bootstrap();

    const stop = subscribeRpcBlocks((block) => {
      if (!alive) return;
      setLive(true);
      if (seen.current.has(block.number)) return;
      seen.current.add(block.number);
      markFresh([block.number]);
      setBlocks((prev) => [block, ...prev].slice(0, LIMIT));
    });

    const fallback = window.setInterval(() => {
      void fetchLatestRpcBlocks(LIMIT)
        .then((latest) => {
          if (!alive) return;
          const novel = latest.filter((b) => !seen.current.has(b.number));
          for (const b of latest) seen.current.add(b.number);
          if (novel.length) markFresh(novel.map((b) => b.number));
          setBlocks(latest);
          setLive(true);
        })
        .catch(() => {
          if (alive) setLive(false);
        });
    }, 5_000);

    return () => {
      alive = false;
      stop();
      window.clearInterval(fallback);
    };
  }, []);

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
          {blocks.map((b) => {
            const isNew = fresh.has(b.number);
            return (
              <tr
                key={b.hash || b.number}
                className={`border-t border-ink-100 ${isNew ? "tx-enter" : ""}`}
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
            );
          })}
          {!blocks.length && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-ink-400">
                Waiting for blocks…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
