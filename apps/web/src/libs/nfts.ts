import { inferNftCategory, type NftCategory } from "@/config/nfts";
import { arcscan, type PageParams } from "@/libs/arcscan";

export type NftCollection = {
  address: string;
  name: string;
  symbol: string;
  holders: number;
  transfers: number | null;
  supply: number | null;
  iconUrl?: string;
  reputation?: string;
  category: Exclude<NftCategory, "all">;
};

export type NftDashboard = {
  collections: NftCollection[];
  activity: Array<{ date: string; value: number }>;
  stats: {
    collections: number;
    holderAccounts: number;
    transfers: number;
    avgHolders: number;
    topName: string;
    txns24h: number;
    activitySpark: number[];
  };
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRow(t: Record<string, unknown>): NftCollection {
  const name = String(t.name ?? "");
  const symbol = String(t.symbol ?? "");
  const supplyRaw = t.total_supply ?? t.circulating_supply;
  const supply = supplyRaw != null && supplyRaw !== "" ? Number(supplyRaw) : null;
  return {
    address: String(t.address_hash ?? "").toLowerCase(),
    name,
    symbol,
    holders: Number(t.holders_count ?? 0),
    transfers: null,
    supply: Number.isFinite(supply!) && supply! > 0 ? supply : null,
    iconUrl: t.icon_url ? String(t.icon_url) : undefined,
    reputation: t.reputation ? String(t.reputation) : undefined,
    category: inferNftCategory(name, symbol),
  };
}

async function fetchCollections(maxPages = 3) {
  const rows: NftCollection[] = [];
  let params: PageParams = null;
  for (let page = 0; page < maxPages; page++) {
    const batch = await arcscan.tokens("ERC-721", params ?? undefined);
    for (const item of batch.items) rows.push(parseRow(item));
    if (!batch.nextPageParams) break;
    params = batch.nextPageParams;
    await sleep(120);
  }
  return rows;
}

async function enrichTransfers(collections: NftCollection[], limit = 40) {
  const top = [...collections].sort((a, b) => b.holders - a.holders).slice(0, limit);
  const xfer = new Map<string, number>();
  for (let i = 0; i < top.length; i += 4) {
    const batch = top.slice(i, i + 4);
    await Promise.all(
      batch.map(async (c) => {
        try {
          const ctr = await arcscan.tokenCounters(c.address);
          xfer.set(c.address, Number(ctr.transfers_count ?? 0));
        } catch {
          /* skip */
        }
      }),
    );
    if (i + 4 < top.length) await sleep(180);
  }
  return collections.map((c) => ({
    ...c,
    transfers: xfer.get(c.address) ?? c.transfers,
  }));
}

export async function loadNftDashboard(): Promise<NftDashboard> {
  const [collections, txChart, counters] = await Promise.all([
    fetchCollections(),
    arcscan.txChart().catch(() => ({ chart_data: [] as Array<{ date: string; transactions_count: number }> })),
    arcscan.statsCounters().catch(() => ({} as Record<string, number>)),
  ]);

  const enriched = await enrichTransfers(collections);

  const activity = (txChart.chart_data ?? [])
    .slice()
    .reverse()
    .map((d) => ({ date: d.date, value: d.transactions_count }));

  const holderAccounts = enriched.reduce((s, c) => s + c.holders, 0);
  const transfers = enriched.reduce((s, c) => s + (c.transfers ?? 0), 0);
  const top = [...enriched].sort((a, b) => b.holders - a.holders)[0];

  return {
    collections: enriched.sort((a, b) => b.holders - a.holders),
    activity,
    stats: {
      collections: enriched.length,
      holderAccounts,
      transfers,
      avgHolders: enriched.length ? Math.round(holderAccounts / enriched.length) : 0,
      topName: top?.name || top?.symbol || "—",
      txns24h: counters.newTxns24h ?? 0,
      activitySpark: activity.slice(-14).map((d) => d.value),
    },
  };
}
