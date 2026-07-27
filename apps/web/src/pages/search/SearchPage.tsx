import { Link, useSearchParams } from "react-router-dom";
import { protocols } from "@arclytics/protocols";
import { useAsyncData } from "@/hooks/useAsyncData";
import { arcscan } from "@/libs/arcscan";

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();
  const local = protocols.filter(
    (p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.slug.includes(query.toLowerCase()),
  );
  const { data: remote, loading, error } = useAsyncData(
    `search:${query}`,
    () => (query ? arcscan.search(query).catch(() => []) : Promise.resolve([])),
    [query],
  );

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  const results = remote ?? [];

  return (
    <div className="space-y-2.5">
      <div className="card divide-y divide-ink-100">
        {local.map((p) => (
          <Link
            key={p.slug}
            to={`/protocols/${p.slug}`}
            className="block px-4 py-3 text-sm hover:bg-ink-50"
          >
            <span className="text-ink-400">Protocol · </span>
            <span className="font-medium text-ink-800">{p.name}</span>
          </Link>
        ))}
        {results.slice(0, 20).map((r, i) => {
          const addr = String(r.address_hash ?? "");
          const label = String(r.name ?? r.symbol ?? addr ?? "result");
          const href = addr ? `/tokens/${addr}` : undefined;
          return href ? (
            <Link key={`${addr}-${i}`} to={href} className="block px-4 py-3 text-sm hover:bg-ink-50">
              <span className="font-medium text-ink-800">{label}</span>
              {addr ? <div className="font-mono text-xs text-ink-400">{addr}</div> : null}
            </Link>
          ) : (
            <div key={`${label}-${i}`} className="px-4 py-3 font-mono text-xs text-ink-500">
              {label}
            </div>
          );
        })}
        {!local.length && !results.length && (
          <div className="px-4 py-10 text-center text-sm text-ink-400">No results.</div>
        )}
      </div>
    </div>
  );
}
