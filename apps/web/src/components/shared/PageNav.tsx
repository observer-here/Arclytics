export function PageNav({
  page,
  hasPrev,
  hasNext,
  loading,
  onPrev,
  onNext,
  pageSize,
  totalPages,
}: {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  loading?: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageSize?: number;
  totalPages?: number;
}) {
  return (
    <div className="flex items-center justify-center gap-3 px-1 pt-2 text-[12px] text-ink-500">
      <button
        type="button"
        disabled={!hasPrev || loading}
        onClick={onPrev}
        className="rounded-md border border-ink-200 px-2.5 py-1 font-medium text-ink-700 enabled:hover:border-arc-500 enabled:hover:text-arc-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Previous
      </button>
      <span className="min-w-[7rem] text-center">
        Page {page}
        {totalPages ? ` of ${totalPages}` : ""}
        {pageSize ? ` · ${pageSize}` : ""}
      </span>
      <button
        type="button"
        disabled={!hasNext || loading}
        onClick={onNext}
        className="rounded-md border border-ink-200 px-2.5 py-1 font-medium text-ink-700 enabled:hover:border-arc-500 enabled:hover:text-arc-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
