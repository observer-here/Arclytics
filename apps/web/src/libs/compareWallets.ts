import { getWallets } from "@/libs/api";
import type { ProtocolRanking } from "@/libs/api";
import type { WalletRow } from "@/libs/wallets";

export async function loadCompareWalletRows(): Promise<WalletRow[]> {
  const feed = await getWallets().catch(() => ({ items: [] as WalletRow[] }));
  return [...(feed.items ?? [])].sort((a, b) => b.netWorth - a.netWorth);
}

export function defaultWalletAddresses(list: WalletRow[]): string[] {
  return list.slice(0, 2).map((w) => w.address);
}

export function protocolFor(to: string, rankings: ProtocolRanking[]) {
  const addr = to.toLowerCase();
  return rankings.find((p) => p.contracts.some((c) => c.toLowerCase() === addr));
}
