import { useCallback } from "react";
import { Link } from "react-router-dom";
import { PageNav } from "@/components/shared/PageNav";
import { usePagedList } from "@/hooks/usePagedList";
import { arcscan, type PageParams } from "@/libs/arcscan";
import { compact } from "@/utils/format";

function shortName(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function TokensPage() {
  const loader = useCallback(
    (params: PageParams) => arcscan.tokens("ERC-20", params),
    [],
  );
  const { items, loading, error, page, hasPrev, hasNext, prevPage, nextPage } =
    usePagedList("tokens-erc20-paged", loader);

  if (loading && !items.length) {
    return <div className="text-sm text-ink-400">Loading…</div>;
  }
  if (error && !items.length) {
    return <div className="text-sm text-ink-400">{error}</div>;
  }

  const rows = items.map((t) => ({
    address: String(t.address_hash),
    name: String(t.name ?? ""),
    symbol: String(t.symbol ?? ""),
    holdersCount: Number(t.holders_count ?? 0),
  }));

  return (
    <div className="space-y-2.5">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Symbol</th>
              <th className="text-right">Holders</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.address}>
                <td>
                  <Link
                    to={`/tokens/${r.address}`}
                    className="font-medium text-ink-800 hover:text-arc-700"
                  >
                    {r.name || shortName(r.address)}
                  </Link>
                </td>
                <td className="text-ink-500">{r.symbol || "—"}</td>
                <td className="text-right font-medium">{compact(r.holdersCount)}</td>
              </tr>
            ))}
            {!rows.length && (
              <tr>
                <td colSpan={3} className="py-10 text-center text-ink-400">
                  No tokens found.
                </td>
              </tr>
            )}
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
        pageSize={rows.length}
      />
    </div>
  );
}
