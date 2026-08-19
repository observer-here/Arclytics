import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { HighlightText, ResultIcon } from "@/components/search/SearchResult";
import { Icons } from "@/components/shared/Icons";
import { getTokens, type TokenFeedRow } from "@/libs/api";
import { arcscan } from "@/libs/arcscan";
import { fetchCache, peekCache } from "@/libs/queryCache";
import {
  TOKENS_CACHE_KEY,
  addressKeys,
  clearRecents,
  groupItems,
  jumpItem,
  pushRecent,
  readRecents,
  remoteItems,
  searchIndex,
  type SearchGroup,
  type SearchItem,
} from "@/libs/search";
import { paths } from "@/routes/paths";
import { shortHash } from "@/utils/format";

const REMOTE_DEBOUNCE_MS = 220;
const MOBILE_WIDTH = 640;
const PREFERRED_WIDTH = 960;
const GUTTER = 12;


function loadTokens() {
  return fetchCache(TOKENS_CACHE_KEY, async () => (await getTokens()).items ?? []);
}

type PanelBox = { left: number; top: number; width: number };

/** Full-width on mobile; on desktop grows right from the input up to the gutter. */
function measurePanel(input: HTMLInputElement | null): PanelBox | null {
  const rect = input?.getBoundingClientRect();
  if (!rect) return null;
  const vw = window.innerWidth;
  const top = rect.bottom + 6;
  if (vw < MOBILE_WIDTH) return { left: GUTTER, top, width: vw - GUTTER * 2 };
  return {
    left: rect.left,
    top,
    width: Math.min(Math.max(rect.width, PREFERRED_WIDTH), vw - GUTTER - rect.left),
  };
}

export function GlobalSearch() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [recents, setRecents] = useState<SearchItem[]>(readRecents);
  const [remoteRows, setRemoteRows] = useState<Array<Record<string, unknown>>>([]);
  const [searching, setSearching] = useState(false);
  const [box, setBox] = useState<PanelBox | null>(null);
  const [tokenRows, setTokenRows] = useState<TokenFeedRow[]>(
    () => peekCache<TokenFeedRow[]>(TOKENS_CACHE_KEY) ?? [],
  );


  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (formRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const measure = () => setBox(measurePanel(inputRef.current));
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [open]);

  useEffect(() => {
    if (tokenRows.length) return;
    let alive = true;
    loadTokens()
      .then((rows) => alive && setTokenRows(rows))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [tokenRows.length]);

  useEffect(() => {
    if (open) setRecents(readRecents());
  }, [open]);

  useEffect(() => {
    const query = q.trim();
    if (!open || query.length < 2 || jumpItem(query)) {
      setRemoteRows([]);
      setSearching(false);
      return;
    }

    let alive = true;
    setSearching(true);
    const timer = setTimeout(() => {
      arcscan
        .search(query)
        .then((rows) => alive && setRemoteRows(Array.isArray(rows) ? rows : []))
        .catch(() => alive && setRemoteRows([]))
        .finally(() => alive && setSearching(false));
    }, REMOTE_DEBOUNCE_MS);

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [q, open]);

  const { groups, flat } = useMemo(() => {
    const query = q.trim();

    if (!query) {
      const list: SearchGroup[] = recents.length ? [{ label: "Recent", items: recents }] : [];
      return { groups: list, flat: list.flatMap((g) => g.items) };
    }

    const jump = jumpItem(query);
    const local = searchIndex(query, tokenRows, 24);
    const seen = addressKeys(jump ? [jump, ...local] : local);
    const seeAll: SearchItem = {
      id: "see-all",
      kind: "page",
      title: `Search for “${query}”`,
      href: `${paths.search}?q=${encodeURIComponent(query)}`,
      icon: "Search",
    };

    const list: SearchGroup[] = [
      ...(jump ? [{ label: "Jump to", items: [jump] }] : []),
      ...groupItems([...local, ...remoteItems(remoteRows, seen, 4)], 5),
      { items: [seeAll] },
    ];
    return { groups: list, flat: list.flatMap((g) => g.items) };
  }, [q, recents, tokenRows, remoteRows]);

  const offsets = useMemo(() => {
    let n = 0;
    return groups.map((g) => {
      const start = n;
      n += g.items.length;
      return start;
    });
  }, [groups]);

  const activeIdx = Math.min(active, Math.max(0, flat.length - 1));

  useEffect(() => setActive(0), [q]);

  useEffect(() => {
    panelRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const go = useCallback(
    (item: SearchItem) => {
      if (item.id !== "see-all") pushRecent(item);
      setOpen(false);
      setQ("");
      if (item.external) window.open(item.href, "_blank", "noopener,noreferrer");
      else navigate(item.href);
      inputRef.current?.blur();
    },
    [navigate],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === "Enter") {
      const item = flat[activeIdx];
      if (!item) return;
      e.preventDefault();
      go(item);
      return;
    }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    if (!open) {
      setOpen(true);
      return;
    }
    if (!flat.length) return;
    const step = e.key === "ArrowDown" ? 1 : -1;
    setActive((i) => (Math.min(i, flat.length - 1) + step + flat.length) % flat.length);
  }

  return (
    <form
      ref={formRef}
      role="search"
      className="relative min-w-0 flex-1"
      onSubmit={(e) => e.preventDefault()}
    >
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400">
        <Icons.Search size={14} />
      </span>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onKeyDown={onInputKeyDown}
        placeholder="Search protocols, tokens, addresses..."
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls="global-search-results"
        aria-autocomplete="list"
        aria-activedescendant={open && flat[activeIdx] ? `gs-option-${activeIdx}` : undefined}
        className="w-full rounded-lg border border-ink-200 bg-ink-50 py-1.5 pl-8 pr-8 text-[13px] text-ink-800 outline-none ring-arc-500 placeholder:text-ink-400 focus:bg-white focus:ring-1"
      />
      {open && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => { setQ(""); setOpen(false); inputRef.current?.blur(); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 grid h-5 w-5 place-items-center rounded text-ink-400 hover:text-ink-700"
          aria-label="Close search"
        >
          <Icons.Close size={13} />
        </button>
      )}

      {open &&
        box &&
        flat.length > 0 &&
        createPortal(
          <>
            <div
              aria-hidden
              className="fixed inset-x-0 bottom-0 top-12 z-30 bg-ink-900/30 backdrop-blur-sm"
            />
            <div
              ref={panelRef}
              style={{ left: box.left, top: box.top, width: box.width }}
              className="no-scrollbar fixed z-40 max-h-[min(72vh,30rem)] overflow-y-auto overscroll-contain rounded-xl border border-ink-200 bg-white py-1 shadow-xl dark:border-[var(--line)] dark:bg-[var(--surface-1)]"
              id="global-search-results"
              role="listbox"
            >
              {groups.map((group, gi) => (
                <div
                  key={group.label ?? "actions"}
                  role="group"
                  aria-label={group.label}
                  className={
                    group.label
                      ? undefined
                      : "mt-1 border-t border-ink-100 pt-1 dark:border-[var(--line-soft)]"
                  }
                >
                  {group.label && (
                    <div className="flex items-center justify-between px-3.5 pb-1 pt-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                        {group.label}
                      </span>
                      {group.label === "Recent" && (
                        <button
                          type="button"
                          onClick={() => { clearRecents(); setRecents([]); }}
                          className="text-[10px] text-ink-400 hover:text-ink-700"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                  {group.items.map((item, ii) => {
                    const idx = offsets[gi] + ii;
                    const selected = idx === activeIdx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="option"
                        id={`gs-option-${idx}`}
                        aria-selected={selected}
                        data-active={selected}
                        onMouseMove={() => setActive(idx)}
                        onClick={() => go(item)}
                        className={`flex w-full items-center gap-3 px-3.5 py-2.5 text-left ${
                          selected ? "bg-ink-50 dark:bg-[var(--surface-2)]" : ""
                        }`}
                      >
                        <ResultIcon item={item} size={26} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-ink-800">
                            <HighlightText text={item.title} range={item.range} />
                          </span>
                          {item.subtitle && (
                            <span className="block truncate text-[11px] text-ink-400">
                              {item.subtitle}
                            </span>
                          )}
                        </span>
                        {item.address && (
                          <span className="hidden shrink-0 font-mono text-[11px] text-ink-400 sm:block">
                            {shortHash(item.address, 8, 6)}
                          </span>
                        )}
                        {item.external && <Icons.Share size={12} className="shrink-0 text-ink-400" />}
                      </button>
                    );
                  })}
                </div>
              ))}

              {searching && (
                <div className="px-3.5 py-2 text-[11px] text-ink-400">Searching on-chain…</div>
              )}
            </div>
          </>,
          document.body,
        )}
    </form>
  );
}
