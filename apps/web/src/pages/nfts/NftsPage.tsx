import { useCallback } from "react";
import { Link } from "react-router-dom";
import { PageNav } from "@/components/shared/PageNav";
import { TokenIcon } from "@/components/shared/TokenIcon";
import { usePagedList } from "@/hooks/usePagedList";
import { arcscan, type PageParams } from "@/libs/arcscan";
import { compact } from "@/utils/format";

function shortName(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function NftsPage() {
  const loader = useCallback(
    (params: PageParams) => arcscan.tokens("ERC-721", params),
    [],
  );
  const { items, loading, error, page, hasPrev, hasNext, prevPage, nextPage } =
    usePagedList("tokens-erc721-paged", loader);

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
    iconUrl: t.icon_url ? String(t.icon_url) : undefined,
  }));

  return (
    <div className="space-y-2.5">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Collection</th>
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
                    className="inline-flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                  >
                    <TokenIcon src={r.iconUrl} symbol={r.symbol} size={22} />
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
                  No NFT collections found.
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
