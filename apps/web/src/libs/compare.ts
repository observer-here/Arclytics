import {
  getProtocolRankings,
  loadProtocolDetail,
  type ProtocolDetail,
  type ProtocolRanking,
} from "@/libs/api";

export type CompareItem = ProtocolRanking & {
  detail: ProtocolDetail | null;
};

export async function loadCompareProtocols(): Promise<ProtocolRanking[]> {
  return getProtocolRankings().catch(() => []);
}

export async function loadCompareDetails(slugs: string[]): Promise<Record<string, ProtocolDetail | null>> {
  const entries = await Promise.all(
    slugs.map(async (slug) => [slug, await loadProtocolDetail(slug)] as const),
  );
  return Object.fromEntries(entries);
}
