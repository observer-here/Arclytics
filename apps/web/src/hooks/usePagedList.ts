import { useCallback, useEffect, useState } from "react";
import type { PageParams, Paged } from "@/libs/arcscan";

export function usePagedList<T>(
  key: string,
  loader: (params: PageParams) => Promise<Paged<T>>,
) {
  const [cursors, setCursors] = useState<PageParams[]>([null]);
  const [page, setPage] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [next, setNext] = useState<PageParams>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (index: number, stack: PageParams[]) => {
      setLoading(true);
      setError(null);
      try {
        const data = await loader(stack[index] ?? null);
        setItems(data.items);
        setNext(data.nextPageParams);
        setPage(index);
        setCursors(stack);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    },
    [loader],
  );

  useEffect(() => {
    void load(0, [null]);
  }, [key, load]);

  const nextPage = () => {
    if (!next || loading) return;
    const stack = cursors.slice(0, page + 1);
    stack.push(next);
    void load(page + 1, stack);
  };

  const prevPage = () => {
    if (page <= 0 || loading) return;
    void load(page - 1, cursors);
  };

  return {
    items,
    loading,
    error,
    page: page + 1,
    hasPrev: page > 0,
    hasNext: Boolean(next),
    nextPage,
    prevPage,
  };
}
