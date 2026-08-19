import { useCallback } from "react";
import { TimeAgo } from "@/components/shared/TimeAgo";
import { PageNav } from "@/components/shared/PageNav";
import { usePagedList } from "@/hooks/usePagedList";
import { arcscan, ARCSCAN_PAGE_SIZE, type PageParams } from "@/libs/arcscan";
import { num, shortHash } from "@/utils/format";
import { Skel, PageNavSkel } from "@/components/shared/Skel";

function BlockRowSkel() {
  return (
    <tr className="border-b border-ink-50">
      <td className="px-2.5 py-1.5">
        <Skel className="h-3.5 w-14" />
      </td>
      <td className="px-2.5 py-1.5">
        <Skel className="h-3.5 w-28" />
      </td>
      <td className="px-2.5 py-1.5">
        <Skel className="h-3.5 w-8" />
      </td>
      <td className="px-2.5 py-1.5">
        <Skel className="ml-auto h-3.5 w-10" />
      </td>
    </tr>
  );
}

export function BlocksPage() {
  const loader = useCallback(
    (params: PageParams) => arcscan.blocksPage(params),
    [],
  );
  const { items, loading, error, page, hasPrev, hasNext, prevPage, nextPage } =
    usePagedList("explorer-blocks", loader);

  const boot = loading && !items.length;

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
            {boot
              ? Array.from({ length: ARCSCAN_PAGE_SIZE }, (_, i) => <BlockRowSkel key={i} />)
              : items.map((b) => (
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
            {!boot && !items.length && (
              <tr>
                <td colSpan={4} className="px-2.5 py-10 text-center text-ink-400">
                  No blocks yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {boot ? (
        <PageNavSkel />
      ) : (
        <PageNav
          page={page}
          hasPrev={hasPrev}
          hasNext={hasNext}
          loading={loading}
          onPrev={prevPage}
          onNext={nextPage}
          pageSize={items.length}
        />
      )}
    </div>
  );
}
