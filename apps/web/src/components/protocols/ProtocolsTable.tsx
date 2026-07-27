import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CategoryFilter } from "@/components/shared/CategoryFilter";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { usd } from "@/utils/format";

export function ProtocolsTable({
  rows,
}: {
  rows: Array<{ slug: string; name: string; category: string; tvlUsd: number }>;
}) {
  const [category, setCategory] = useState<ProtocolCategoryFilter>("all");
  const filtered = useMemo(
    () => (category === "all" ? rows : rows.filter((r) => r.category === category)),
    [rows, category],
  );

  return (
    <div>
      <div className="mb-2">
        <CategoryFilter value={category} onChange={setCategory} />
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>Category</th>
              <th className="text-right">TVL</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => (
              <tr key={r.slug}>
                <td className="text-ink-400">{i + 1}</td>
                <td>
                  <Link to={`/protocols/${r.slug}`} className="font-medium text-ink-800 hover:text-arc-700">
                    {r.name}
                  </Link>
                </td>
                <td className="capitalize text-ink-500">
                  {CATEGORY_LABELS[r.category as ProtocolCategoryFilter] ?? r.category}
                </td>
                <td className="text-right font-medium text-ink-800">{usd(r.tvlUsd)}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-ink-400">
                  No protocols in this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
