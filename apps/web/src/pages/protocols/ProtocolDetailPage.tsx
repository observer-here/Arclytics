import { Link, useParams } from "react-router-dom";
import { getProtocol } from "@arclytics/protocols";
import { CATEGORY_LABELS, type ProtocolCategoryFilter } from "@/config/categories";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getProtocolRankings } from "@/libs/dashboard";
import { paths } from "@/routes/paths";
import { shortHash, usd } from "@/utils/format";

export function ProtocolDetailPage() {
  const { slug = "" } = useParams();
  const protocol = getProtocol(slug);
  const { data: rankings, loading, error } = useAsyncData(
    "protocol-rankings",
    () => getProtocolRankings().catch(() => []),
  );

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  if (!protocol) {
    return <div className="card p-6 text-ink-500">Protocol not found.</div>;
  }

  const tvl = (rankings ?? []).find((r) => r.slug === slug);
  const category =
    CATEGORY_LABELS[protocol.category as ProtocolCategoryFilter] ?? protocol.category;

  return (
    <div className="space-y-2.5">
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="text-xs capitalize text-arc-600">{category}</div>
            <div className="mt-0.5 text-xl font-semibold text-ink-900">{protocol.name}</div>
          </div>
          {protocol.website ? (
            <a
              href={protocol.website}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-arc-600 hover:text-arc-700"
            >
              Website
            </a>
          ) : null}
        </div>
        <div className="mt-4 text-xs text-ink-400">Total Value Locked</div>
        <div className="mt-1 text-3xl font-semibold text-ink-900">{usd(tvl?.tvlUsd ?? 0)}</div>
      </div>

      <div className="table-wrap">
        <div className="border-b border-ink-100 px-4 py-3 font-semibold text-ink-900">Contracts</div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Label</th>
              <th>Role</th>
              <th>Address</th>
            </tr>
          </thead>
          <tbody>
            {protocol.contracts.map((c) => (
              <tr key={c.address}>
                <td className="font-medium text-ink-800">{c.label ?? c.role}</td>
                <td className="capitalize text-ink-500">{c.role}</td>
                <td className="font-mono text-xs text-ink-500">{shortHash(c.address, 10, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Link to={paths.protocols} className="text-sm font-medium text-arc-600 hover:text-arc-700">
        ← All protocols
      </Link>
    </div>
  );
}
