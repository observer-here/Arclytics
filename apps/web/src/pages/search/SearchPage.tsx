import { Link, useSearchParams } from "react-router-dom";
import { HighlightText, ResultIcon } from "@/components/search/SearchResult";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getTokens, type TokenFeedRow } from "@/libs/api";
import { arcscan } from "@/libs/arcscan";
import {
  TOKENS_CACHE_KEY,
  addressKeys,
  groupItems,
  jumpItem,
  remoteItems,
  searchIndex,
  type SearchItem,
} from "@/libs/search";

function ResultRow({ item }: { item: SearchItem }) {
  const body = (
    <>
      <ResultIcon item={item} size={26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink-800">
          <HighlightText text={item.title} range={item.range} />
        </span>
        {item.subtitle && (
          <span className="block truncate text-[11px] text-ink-400">{item.subtitle}</span>
        )}
      </span>
      {item.address && (
        <span className="hidden shrink-0 font-mono text-[11px] text-ink-400 sm:block">
          {item.address}
        </span>
      )}
    </>
  );

  const className = "flex items-center gap-2.5 px-3 py-2.5 hover:bg-ink-50";

  return item.external ? (
    <a href={item.href} target="_blank" rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <Link to={item.href} className={className}>
      {body}
    </Link>
  );
}

export function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("q") ?? "").trim();

  const { data: tokenRows } = useAsyncData<TokenFeedRow[]>(
    TOKENS_CACHE_KEY,
    async () => (await getTokens()).items ?? [],
  );

  const { data: remote, loading } = useAsyncData(
    `search:${query}`,
    () => (query.length >= 2 ? arcscan.search(query).catch(() => []) : Promise.resolve([])),
    [query],
  );

  if (!query) {
    return <div className="text-sm text-ink-400">Type something to search.</div>;
  }

  const jump = jumpItem(query);
  const local = searchIndex(query, tokenRows ?? [], 40);
  const seen = addressKeys(jump ? [jump, ...local] : local);
  const groups = [
    ...(jump ? [{ label: "Jump to", items: [jump] }] : []),
    ...groupItems([...local, ...remoteItems(remote ?? [], seen, 20)]),
  ];
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-2.5">
      <div className="text-[12px] text-ink-400">
        {total ? `${total} result${total === 1 ? "" : "s"} for “${query}”` : null}
      </div>

      {groups.map((group) => (
        <div key={group.label} className="card overflow-hidden">
          <div className="border-b border-ink-100 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            {group.label}
          </div>
          <div className="divide-y divide-ink-100">
            {group.items.map((item) => (
              <ResultRow key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}

      {!total && (
        <div className="card px-4 py-10 text-center text-sm text-ink-400">
          {loading ? "Searching…" : `No results for “${query}”.`}
        </div>
      )}
    </div>
  );
}
