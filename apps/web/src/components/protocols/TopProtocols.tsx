import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { CategoryFilter } from "@/components/shared/CategoryFilter";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { usd } from "@/utils/format";

export function TopProtocols({
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
    <div className="card p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="panel-title">Top Protocols</div>
        <Link to="/protocols" className="text-[11px] font-medium text-arc-600 hover:text-arc-700">
          View all
        </Link>
      </div>
      <div className="mb-1.5 overflow-x-auto">
        <CategoryFilter value={category} onChange={setCategory} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] text-ink-400">
              <th className="pb-1 font-medium">#</th>
              <th className="pb-1 font-medium">Protocol</th>
              <th className="pb-1 font-medium">Category</th>
              <th className="pb-1 text-right font-medium">TVL</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 8).map((r, i) => (
              <tr key={r.slug} className="border-t border-ink-100">
                <td className="py-1.5 text-ink-400">{i + 1}</td>
                <td className="py-1.5">
                  <Link to={`/protocols/${r.slug}`} className="flex items-center gap-1.5 font-medium text-ink-800">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-arc-50 text-[10px] font-semibold text-arc-700">
                      {r.name.slice(0, 1)}
                    </span>
                    {r.name}
                  </Link>
                </td>
                <td className="py-1.5 capitalize text-ink-500">
                  {CATEGORY_LABELS[r.category as ProtocolCategoryFilter] ?? r.category}
                </td>
                <td className="py-1.5 text-right font-medium text-ink-800">{usd(r.tvlUsd)}</td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-ink-400">
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
