import { useCallback } from "react";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { PageNav } from "@/components/shared/PageNav";
import { usePagedList } from "@/hooks/usePagedList";
import { arcscan, type PageParams } from "@/libs/arcscan";
import { shortHash } from "@/utils/format";

export function ExplorerPage() {
  const loader = useCallback(
    (params: PageParams) => arcscan.transactionsPage(params),
    [],
  );
  const { items, loading, error, page, hasPrev, hasNext, prevPage, nextPage } =
    usePagedList("explorer-txs", loader);

  if (loading && !items.length) {
    return <div className="text-sm text-ink-400">Loading…</div>;
  }
  if (error && !items.length) {
    return <div className="text-sm text-ink-400">{error}</div>;
  }

  return (
    <div className="space-y-2.5">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Hash</th>
              <th>Method</th>
              <th>From</th>
              <th className="text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {items.map((tx) => (
              <tr key={String(tx.hash)}>
                <td className="font-mono text-xs">{shortHash(String(tx.hash), 10, 8)}</td>
                <td>{String(tx.method ?? "transfer")}</td>
                <td className="font-mono text-xs text-ink-500">
                  {shortHash(String((tx.from as { hash?: string } | undefined)?.hash ?? ""))}
                </td>
                <td className="text-right text-ink-400">
                  {tx.timestamp ? <TimeAgo ts={String(tx.timestamp)} /> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
