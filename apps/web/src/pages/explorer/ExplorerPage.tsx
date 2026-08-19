import { useCallback } from "react";
import { Link } from "react-router-dom";
import { Icons } from "@/components/shared/Icons";
import { PageNav } from "@/components/shared/PageNav";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { explorerUrl } from "@/config/network";
import { usePagedList } from "@/hooks/usePagedList";
import { arcscan, ARCSCAN_PAGE_SIZE, type PageParams } from "@/libs/arcscan";
import { paths } from "@/routes/paths";
import { feeUsdc, shortHash } from "@/utils/format";
import { Skel } from "@/components/shared/Skel";

function TxRowSkel() {
  return (
    <tr className="border-b border-ink-50">
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Skel className="h-1.5 w-1.5 shrink-0 rounded-full" />
          <Skel className="h-5 w-5 shrink-0 rounded" />
          <Skel className="h-3.5 w-28" />
        </div>
      </td>
      <td className="px-3 py-2">
        <Skel className="h-5 w-16 rounded-full" />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Skel className="h-5 w-5 shrink-0 rounded" />
          <Skel className="h-3.5 w-20" />
        </div>
      </td>
      <td className="px-3 py-2">
        <Skel className="ml-auto h-3.5 w-14" />
      </td>
      <td className="px-3 py-2">
        <Skel className="ml-auto h-3.5 w-10" />
      </td>
    </tr>
  );
}

function methodTone(method: string) {
  const m = method.toLowerCase();
  if (m.includes("transfer") || m.includes("send")) return "bg-sky-50 text-sky-700";
  if (m.includes("swap") || m.includes("exchange")) return "bg-violet-50 text-violet-700";
  if (m.includes("approve")) return "bg-amber-50 text-amber-700";
  if (m.includes("mint") || m.includes("deposit")) return "bg-emerald-50 text-emerald-700";
  if (m.includes("burn") || m.includes("withdraw")) return "bg-rose-50 text-rose-700";
  return "bg-ink-50 text-ink-600";
}

function StatusDot({ ok }: { ok: boolean | null }) {
  if (ok == null) return <span className="h-1.5 w-1.5 rounded-full bg-ink-300" />;
  return (
    <span
      className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"}`}
      title={ok ? "Success" : "Failed"}
    />
  );
}

export function ExplorerPage() {
  const loader = useCallback(
    (params: PageParams) => arcscan.transactionsPage(params),
    [],
  );
  const { items, loading, error, page, hasPrev, hasNext, prevPage, nextPage } =
    usePagedList("explorer-txs", loader);

  const boot = loading && !items.length;

  if (error && !items.length) {
    return <div className="text-sm text-ink-400">{error}</div>;
  }

  return (
    <div className="space-y-2.5">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
          <div className="flex items-center gap-1.5 text-[12px] font-medium text-ink-700">
            <Icons.Tx size={13} className="text-arc-600" />
            Latest transactions
          </div>
          {boot ? (
            <Skel className="h-5 w-12 rounded-md" />
          ) : (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12px]">
            <thead>
              <tr className="border-b border-ink-100 text-[11px] text-ink-400">
                <th className="px-3 py-2 font-medium">Txn Hash</th>
                <th className="px-3 py-2 font-medium">Method</th>
                <th className="px-3 py-2 font-medium">From</th>
                <th className="px-3 py-2 text-right font-medium">Fee</th>
                <th className="px-3 py-2 text-right font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {boot
                ? Array.from({ length: ARCSCAN_PAGE_SIZE }, (_, i) => <TxRowSkel key={i} />)
                : items.map((tx) => {
                const hash = String(tx.hash);
                const method = String(tx.method ?? "transfer");
                const from = String((tx.from as { hash?: string } | undefined)?.hash ?? "");
                const fee = (tx.fee as { value?: string } | undefined)?.value;
                const result = String(tx.result ?? tx.status ?? "");
                const ok =
                  result === "success" || result === "ok"
                    ? true
                    : result === "error" || result === "failed"
                      ? false
                      : null;

                return (
                  <tr key={hash} className="border-b border-ink-50 hover:bg-ink-50/60">
                    <td className="px-3 py-2">
                      <a
                        href={explorerUrl(`/tx/${hash}`)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-arc-700 hover:underline"
                      >
                        <StatusDot ok={ok} />
                        <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-violet-50 text-violet-600">
                          <Icons.Tx size={11} />
                        </span>
                        {shortHash(hash, 10, 8)}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex max-w-[140px] truncate rounded-full px-2 py-0.5 text-[10px] font-medium ${methodTone(method)}`}
                      >
                        {method}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      {from ? (
                        <Link
                          to={paths.address(from)}
                          className="inline-flex items-center gap-1.5 font-mono text-[11px] text-ink-500 hover:text-arc-700"
                        >
                          <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-ink-50 text-ink-400">
                            <Icons.Wallet size={11} />
                          </span>
                          {shortHash(from)}
                        </Link>
                      ) : (
                        <span className="text-ink-300">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="inline-flex items-center justify-end gap-1 font-medium text-ink-700">
                        <Icons.Gas size={11} className="text-amber-500" />
                        {feeUsdc(fee)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-ink-400">
                      {tx.timestamp ? <TimeAgo ts={String(tx.timestamp)} /> : "—"}
                    </td>
                  </tr>
                );
              })}
              {!boot && !items.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-ink-400">
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PageNav
        page={page}
        hasPrev={hasPrev}
        hasNext={hasNext}
        loading={loading}
        onPrev={prevPage}
        onNext={nextPage}
        pageSize={items.length}
      />
    </div>
  );
}
