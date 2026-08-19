import { Icons } from "@/components/shared/Icons";
import { ProtocolIcon } from "@/components/shared/ProtocolIcon";
import { TokenIcon } from "@/components/shared/TokenIcon";
import type { SearchItem } from "@/libs/search";

export function ResultIcon({ item, size = 22 }: { item: SearchItem; size?: number }) {
  if (item.kind === "protocol" && item.slug) {
    return (
      <ProtocolIcon slug={item.slug} name={item.title} category={item.category} size={size} />
    );
  }

  if (item.kind === "token") {
    return (
      <TokenIcon
        address={item.address}
        src={item.iconUrl}
        symbol={item.symbol || item.title}
        size={size}
      />
    );
  }

  const Icon = Icons[item.icon ?? "Search"];
  return (
    <span
      className="grid shrink-0 place-items-center rounded-md bg-ink-100 text-ink-500"
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.55)} />
    </span>
  );
}

export function HighlightText({ text, range }: { text: string; range?: [number, number] }) {
  if (!range) return <>{text}</>;
  const [start, end] = range;
  return (
    <>
      {text.slice(0, start)}
      <mark className="bg-transparent font-semibold text-arc-600">{text.slice(start, end)}</mark>
      {text.slice(end)}
    </>
  );
}
