import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { TimeAgo } from "@/components/shared/TimeAgo";
import {
  fetchLatestRpcTxs,
  subscribeRpcBlocks,
  type LiveTx,
} from "@/libs/arcRpc";
import { paths } from "@/routes/paths";
import { shortHash } from "@/utils/format";

const LIMIT = 12;

export function RecentTransactions() {
  const [txs, setTxs] = useState<LiveTx[]>([]);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [live, setLive] = useState(false);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let alive = true;

    const markFresh = (hashes: string[]) => {
      if (!hashes.length) return;
      const newHashes = new Set(hashes);
      setFresh(newHashes);
      window.setTimeout(() => {
        if (!alive) return;
        setFresh((cur) => {
          const next = new Set(cur);
          for (const h of newHashes) next.delete(h);
          return next;
        });
      }, 900);
    };

    const bootstrap = async () => {
      try {
        const latest = await fetchLatestRpcTxs(LIMIT);
        if (!alive) return;
        seen.current = new Set(latest.map((t) => t.hash));
        setTxs(latest);
        setLive(true);
      } catch {
        if (alive) setLive(false);
      }
    };

    void bootstrap();

    const stop = subscribeRpcBlocks((block) => {
      if (!alive || !block.txs.length) return;
      setLive(true);
      const novel = block.txs.filter((tx) => !seen.current.has(tx.hash));
      if (!novel.length) return;
      for (const tx of novel) seen.current.add(tx.hash);
      markFresh(novel.map((t) => t.hash));
      setTxs((prev) => {
        const merged = [...novel, ...prev];
        const uniq = new Map<string, LiveTx>();
        for (const tx of merged) {
          if (!uniq.has(tx.hash)) uniq.set(tx.hash, tx);
        }
        return [...uniq.values()].slice(0, LIMIT);
      });
    });

    const fallback = window.setInterval(() => {
      void fetchLatestRpcTxs(LIMIT)
        .then((latest) => {
          if (!alive) return;
          const novel = latest.filter((tx) => !seen.current.has(tx.hash));
          for (const tx of latest) seen.current.add(tx.hash);
          if (novel.length) markFresh(novel.map((t) => t.hash));
          setTxs(latest);
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
          <div className="panel-title">Latest Transactions</div>
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
          {txs.map((tx) => {
            const isNew = fresh.has(tx.hash);
            return (
              <tr
                key={tx.hash}
                className={`border-t border-ink-100 ${isNew ? "tx-enter" : ""}`}
              >
                <td className="py-1.5 font-mono text-[11px] text-ink-700">
                  {shortHash(tx.hash, 8, 6)}
                </td>
                <td className="py-1.5 text-ink-600">{tx.method}</td>
                <td className="py-1.5 font-mono text-[11px] text-ink-500">
                  {shortHash(tx.from.hash)}
                </td>
                <td className="py-1.5 text-right text-ink-400">
                  <TimeAgo ts={tx.timestamp} />
                </td>
              </tr>
            );
          })}
          {!txs.length && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-ink-400">
                Waiting for transactions…
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
