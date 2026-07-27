import { useCallback } from "react";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { PageNav } from "@/components/shared/PageNav";
import { usePagedList } from "@/hooks/usePagedList";
import { arcscan, type PageParams } from "@/libs/arcscan";
import { num, shortHash } from "@/utils/format";

export function BlocksPage() {
  const loader = useCallback(
    (params: PageParams) => arcscan.blocksPage(params),
    [],
  );
  const { items, loading, error, page, hasPrev, hasNext, prevPage, nextPage } =
    usePagedList("explorer-blocks", loader);

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
              <th>Block</th>
              <th>Hash</th>
              <th>Txns</th>
              <th className="text-right">Age</th>
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={String(b.hash)}>
                <td className="font-medium">#{num(Number(b.height ?? b.number))}</td>
                <td className="font-mono text-xs text-ink-500">
                  {shortHash(String(b.hash), 10, 8)}
                </td>
                <td>{Number(b.tx_count ?? b.transactions_count ?? 0)}</td>
                <td className="text-right text-ink-400">
                  {b.timestamp ? <TimeAgo ts={String(b.timestamp)} /> : "—"}
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
