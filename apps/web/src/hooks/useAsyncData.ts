import { useEffect, useState } from "react";
import { fetchCache, peekCache } from "@/libs/queryCache";

export function useAsyncData<T>(
  key: string,
  loader: () => Promise<T>,
  deps: unknown[] = [],
) {
  const cached = peekCache<T>(key);
  const [data, setData] = useState<T | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const hit = peekCache<T>(key);
    if (hit !== undefined) {
      setData(hit);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    fetchCache(key, loader)
      .then((v) => {
        if (!alive) return;
        setData(v);
        setError(null);
      })
      .catch((e) => {
        if (!alive) return;
        if (peekCache<T>(key) === undefined) {
          setError(e instanceof Error ? e.message : "Failed to load");
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
