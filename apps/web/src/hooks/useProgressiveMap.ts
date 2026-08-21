import { useEffect, useRef, useState } from "react";

/** Load each key independently; UI updates as each result arrives. */
export function useProgressiveMap<T>(
  keys: string[],
  loader: (key: string) => Promise<T | null>,
) {
  const [data, setData] = useState<Record<string, T | null>>({});
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const cache = useRef(data);
  cache.current = data;

  const keySig = keys.join("|");

  useEffect(() => {
    let alive = true;
    const list = keySig ? keySig.split("|").filter(Boolean) : [];
    if (!list.length) return;

    for (const key of list) {
      if (key in cache.current) continue;
      setPending((p) => (p[key] ? p : { ...p, [key]: true }));
      void loader(key).then((v) => {
        if (!alive) return;
        setData((d) => ({ ...d, [key]: v }));
        setPending((p) => {
          if (!p[key]) return p;
          const next = { ...p };
          delete next[key];
          return next;
        });
      });
    }

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keySig]);

  const anyPending = keys.some((k) => pending[k] || !(k in data));

  return { data, pending, anyPending };
}
