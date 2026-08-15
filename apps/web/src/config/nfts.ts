import type { ReactNode } from "react";
import { Icons } from "@/components/shared/Icons";

export type NftCategory =
  | "all"
  | "pfp"
  | "gaming"
  | "art"
  | "collectibles"
  | "domain"
  | "other";

export const NFT_FILTERS: Array<{
  id: NftCategory;
  label: string;
  icon: (p: { size?: number }) => ReactNode;
}> = [
  { id: "all", label: "All", icon: Icons.Nfts },
  { id: "pfp", label: "PFPs", icon: Icons.Users },
  { id: "gaming", label: "Gaming", icon: Icons.DeFi },
  { id: "art", label: "Art", icon: Icons.Activity },
  { id: "collectibles", label: "Collectibles", icon: Icons.Star },
  { id: "domain", label: "Domains", icon: Icons.Search },
  { id: "other", label: "Other", icon: Icons.Tokens },
];

export const NFT_CATEGORY_PILL: Record<Exclude<NftCategory, "all">, string> = {
  pfp: "bg-sky-100 text-sky-700",
  gaming: "bg-rose-100 text-rose-700",
  art: "bg-violet-100 text-violet-700",
  collectibles: "bg-amber-100 text-amber-700",
  domain: "bg-emerald-100 text-emerald-700",
  other: "bg-ink-100 text-ink-600",
};

export function inferNftCategory(name: string, symbol: string): Exclude<NftCategory, "all"> {
  const s = `${name} ${symbol}`.toLowerCase();
  if (/domain|\.arc|name|ens|infinite|iname/.test(s)) return "domain";
  if (/game|gaming|knight|quest|arena|battle|hero/.test(s)) return "gaming";
  if (/art|gallery|canvas|paint|draw/.test(s)) return "art";
  if (/punk|ape|cat|moon|sun|avatar|pfp|face|crew|gang|club/.test(s)) return "pfp";
  if (/collect|card|badge|pass|ticket|memorial|legacy/.test(s)) return "collectibles";
  return "other";
}
