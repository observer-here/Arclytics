type Entry = {
  value: unknown;
  at: number;
  promise?: Promise<unknown>;
};

const store = new Map<string, Entry>();
const TTL = 60_000;

export function peekCache<T>(key: string): T | undefined {
  return store.get(key)?.value as T | undefined;
}

export function fetchCache<T>(
  key: string,
  loader: () => Promise<T>,
  ttl = TTL,
): Promise<T> {
  const cur = store.get(key);
  if (cur?.promise) return cur.promise as Promise<T>;
  if (cur && Date.now() - cur.at < ttl) return Promise.resolve(cur.value as T);

  const promise = loader()
    .then((value) => {
      store.set(key, { value, at: Date.now() });
      return value;
    })
    .catch((err) => {
      const e = store.get(key);
      if (e?.promise === promise) {
        store.set(key, { value: e.value, at: e.at });
      }
      throw err;
    });

  store.set(key, {
    value: cur?.value,
    at: cur?.at ?? 0,
    promise,
  });

  return promise;
}

export function prefetch(key: string, loader: () => Promise<unknown>) {
  void fetchCache(key, loader).catch(() => undefined);
}

export function clearCache(key?: string) {
  if (key) store.delete(key);
  else store.clear();
}
