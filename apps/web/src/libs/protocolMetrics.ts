import { protocols } from "@arclytics/protocols";
import { priceUsd, sumTvlUsd, toNumber } from "@arclytics/math";
import type { ProtocolConfig } from "@arclytics/types";
import { arcscan, type PageParams } from "./arcscan";
import { recordTvlSnapshot, tvlChangePct } from "./tvlSnapshots";

const TVL_ROLES = new Set(["vault", "pool", "router", "lending_pool"]);
const DAY_MS = 86_400_000;
const MAX_TRANSFER_PAGES = 8;

async function protocolTvl(p: ProtocolConfig) {
  const balances = [];
  const contracts = p.contracts.filter((c) => TVL_ROLES.has(c.role));
  for (const c of contracts) {
    try {
      const tokens = await arcscan.addressTokens(c.address);
      for (const item of tokens.items ?? []) {
        const token = item.token as { address_hash?: string; decimals?: string } | undefined;
        const address = (token?.address_hash ?? "").toLowerCase();
        if (!p.tvlTokens.some((t) => t.toLowerCase() === address)) continue;
        balances.push({
          token: address,
          raw: String(item.value ?? "0"),
          decimals: Number(token?.decimals ?? 18),
        });
      }
    } catch {
      // skip
    }
  }
  return sumTvlUsd(balances);
}

async function volumeFromTransfers(p: ProtocolConfig) {
  const tracked = new Set(p.tvlTokens.map((t) => t.toLowerCase()));
  const cutoff = Date.now() - DAY_MS;
  let sampleUsd = 0;
  let newest = 0;
  let oldest = Number.POSITIVE_INFINITY;
  let coveredFullDay = false;

  for (const c of p.contracts) {
    let params: PageParams = null;
    for (let page = 0; page < MAX_TRANSFER_PAGES; page++) {
      let batch;
      try {
        batch = await arcscan.addressTokenTransfers(c.address, params);
      } catch {
        break;
      }
      if (!batch.items.length) break;

      for (const item of batch.items) {
        const ts = item.timestamp ? new Date(String(item.timestamp)).getTime() : 0;
        if (!ts) continue;
        if (ts < cutoff) {
          coveredFullDay = true;
          break;
        }
        newest = Math.max(newest, ts);
        oldest = Math.min(oldest, ts);
        const token = item.token as { address_hash?: string } | undefined;
        const addr = (token?.address_hash ?? "").toLowerCase();
        if (!tracked.has(addr)) continue;
        const total = item.total as { value?: string; decimals?: string } | undefined;
        const amount = toNumber(String(total?.value ?? "0"), Number(total?.decimals ?? 18));
        sampleUsd += amount * priceUsd(addr);
      }

      if (coveredFullDay || !batch.nextPageParams) break;
      params = batch.nextPageParams;
    }
  }

  let volume24h = sampleUsd;
  if (!coveredFullDay && newest > oldest && Number.isFinite(oldest)) {
    const span = Math.max(newest - oldest, 1);
    volume24h = sampleUsd * (DAY_MS / span);
  }

  const fees24h = p.category === "dex" && volume24h > 0 ? volume24h * 0.003 : undefined;
  return { volume24h, fees24h };
}

async function protocolAge(p: ProtocolConfig) {
  let oldest: number | null = null;
  for (const c of p.contracts) {
    try {
      const info = await arcscan.address(c.address);
      const hash = String(info.creation_transaction_hash ?? "");
      if (!hash) continue;
      const tx = await arcscan.transaction(hash);
      const ts = tx.timestamp ? new Date(String(tx.timestamp)).getTime() : NaN;
      if (!Number.isFinite(ts)) continue;
      if (oldest == null || ts < oldest) oldest = ts;
    } catch {
      // skip
    }
  }
  if (oldest == null) return undefined;
  const days = Math.max(0, Math.floor((Date.now() - oldest) / DAY_MS));
  if (days < 1) return "<1d";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

async function protocolActivity(p: ProtocolConfig) {
  let txs = 0;
  let transfers = 0;
  for (const c of p.contracts) {
    try {
      const counters = await arcscan.addressCounters(c.address);
      txs += Number(counters.transactions_count ?? 0);
      transfers += Number(counters.token_transfers_count ?? 0);
    } catch {
      // skip
    }
  }
  return { txs, transfers };
}

export async function getProtocolRankings() {
  const rows = await Promise.all(
    protocols.map(async (p) => {
      const [tvlUsd, vol, age, activity] = await Promise.all([
        protocolTvl(p),
        volumeFromTransfers(p),
        protocolAge(p),
        protocolActivity(p),
      ]);
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        tvlUsd,
        volume24h: vol.volume24h,
        fees24h: vol.fees24h,
        age,
        txs: activity.txs,
        transfers: activity.transfers,
        contracts: p.contracts.map((c) => c.address),
      };
    }),
  );

  const tvlMap = Object.fromEntries(rows.map((r) => [r.slug, r.tvlUsd]));
  recordTvlSnapshot(tvlMap);

  return rows
    .map((r) => ({
      ...r,
      change24h: tvlChangePct(r.slug, r.tvlUsd, 1),
      change7d: tvlChangePct(r.slug, r.tvlUsd, 7),
      change1m: tvlChangePct(r.slug, r.tvlUsd, 30),
    }))
    .sort((a, b) => b.tvlUsd - a.tvlUsd);
}

export type ProtocolRanking = Awaited<ReturnType<typeof getProtocolRankings>>[number];
