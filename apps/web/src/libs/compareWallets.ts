import { getProtocolRankings, getWallets, type ProtocolRanking } from "@/libs/api";
import { loadAddressDetail, type AddressDetail } from "@/libs/addressDetail";
import type { WalletRow } from "@/libs/wallets";

export type WalletCompareBundle = {
  wallets: WalletRow[];
  rankings: ProtocolRanking[];
};

export async function loadCompareWalletList(): Promise<WalletCompareBundle> {
  const [feed, rankings] = await Promise.all([
    getWallets().catch(() => ({ items: [] as WalletRow[] })),
    getProtocolRankings().catch(() => [] as ProtocolRanking[]),
  ]);
  return {
    wallets: [...(feed.items ?? [])].sort((a, b) => b.netWorth - a.netWorth),
    rankings,
  };
}

export async function loadCompareWalletDetails(
  addresses: string[],
): Promise<Record<string, AddressDetail | null>> {
  const entries = await Promise.all(
    addresses.map(async (a) => [a.toLowerCase(), await loadAddressDetail(a)] as const),
  );
  return Object.fromEntries(entries);
}

export function defaultWalletAddresses(list: WalletRow[]): string[] {
  return list.slice(0, 2).map((w) => w.address);
}

export function protocolFor(to: string, rankings: ProtocolRanking[]) {
  const addr = to.toLowerCase();
  return rankings.find((p) => p.contracts.some((c) => c.toLowerCase() === addr));
}
