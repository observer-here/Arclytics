import { getTokens, type TokenFeedRow } from "@/libs/api";
import { loadTokenDetail, type TokenDetail } from "@/libs/tokenDetail";

export async function loadCompareTokenList(): Promise<TokenFeedRow[]> {
  const feed = await getTokens().catch(() => ({ items: [] as TokenFeedRow[] }));
  return [...(feed.items ?? [])].sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
}

export async function loadCompareTokenDetails(
  addresses: string[],
): Promise<Record<string, TokenDetail | null>> {
  const entries = await Promise.all(
    addresses.map(async (a) => [a.toLowerCase(), await loadTokenDetail(a)] as const),
  );
  return Object.fromEntries(entries);
}

export function defaultTokenAddresses(list: TokenFeedRow[]): string[] {
  const prefer = ["ARC", "USDC.E", "USDC", "WARC", "WETH", "WUSDC"];
  const picked: string[] = [];
  for (const sym of prefer) {
    const hit = list.find(
      (t) => t.symbol.toUpperCase() === sym && !picked.includes(t.address.toLowerCase()),
    );
    if (hit) picked.push(hit.address);
    if (picked.length >= 3) break;
  }
  for (const t of list) {
    if (picked.length >= 3) break;
    if (!picked.includes(t.address.toLowerCase())) picked.push(t.address);
  }
  return picked.slice(0, 3);
}
