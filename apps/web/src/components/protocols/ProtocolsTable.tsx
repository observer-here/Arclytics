import { Link } from "react-router-dom";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { usd } from "@/utils/format";

export function ProtocolsTable({
  rows,
}: {
  rows: Array<{ slug: string; name: string; category: string; tvlUsd: number }>;
}) {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="w-7 !pr-0">#</th>
            <th className="!pl-1.5">Name</th>
            <th>Category</th>
            <th className="text-right">TVL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.slug}>
              <td className="w-7 !pr-0 text-ink-400">{i + 1}</td>
              <td className="!pl-1.5">
                <Link
                  to={`/protocols/${r.slug}`}
                  className="inline-flex items-center gap-2 font-medium text-ink-800 hover:text-arc-700"
                >
                  <ProtocolIcon slug={r.slug} name={r.name} category={r.category} size={22} />
                  {r.name}
                </Link>
              </td>
              <td className="capitalize text-ink-500">
                {CATEGORY_LABELS[r.category as ProtocolCategoryFilter] ?? r.category}
              </td>
              <td className="text-right font-medium text-ink-800">{usd(r.tvlUsd)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={4} className="py-8 text-center text-ink-400">
                No protocols
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
