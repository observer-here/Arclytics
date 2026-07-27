import { CATEGORY_LABELS, PROTOCOL_CATEGORIES, type ProtocolCategoryFilter } from "@/config/categories";

export function CategoryFilter({
  value,
  onChange,
}: {
  value: ProtocolCategoryFilter;
  onChange: (v: ProtocolCategoryFilter) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {PROTOCOL_CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`chip ${value === c ? "chip-active" : ""}`}
        >
          {CATEGORY_LABELS[c]}
        </button>
      ))}
    </div>
  );
}
