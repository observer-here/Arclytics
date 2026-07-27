import { protocols } from "@arclytics/protocols";
import { priceUsd, sumTvlUsd, toNumber } from "@arclytics/math";
import type { ProtocolConfig } from "@arclytics/types";
import { arcscan, type PageParams } from "./arcscan";
import { fetchCache } from "./queryCache";
import { recordTvlSnapshot, tvlChangePct } from "./tvlSnapshots";

const TVL_ROLES = new Set(["vault", "pool", "router", "lending_pool"]);
const DAY_MS = 86_400_000;
const MAX_TRANSFER_PAGES = 1;
const RANKINGS_TTL = 120_000;

async function protocolTvl(p: ProtocolConfig) {
  const contracts = p.contracts.filter((c) => TVL_ROLES.has(c.role));
  const batches = await Promise.all(
    contracts.map(async (c) => {
      try {
        const tokens = await arcscan.addressTokens(c.address);
        const out = [];
        for (const item of tokens.items ?? []) {
          const token = item.token as { address_hash?: string; decimals?: string } | undefined;
          const address = (token?.address_hash ?? "").toLowerCase();
          if (!p.tvlTokens.some((t) => t.toLowerCase() === address)) continue;
          out.push({
            token: address,
            raw: String(item.value ?? "0"),
            decimals: Number(token?.decimals ?? 18),
          });
        }
        return out;
      } catch {
        return [];
      }
    }),
  );
  return sumTvlUsd(batches.flat());
}

async function volumeFromTransfers(p: ProtocolConfig) {
  const tracked = new Set(p.tvlTokens.map((t) => t.toLowerCase()));
  const cutoff = Date.now() - DAY_MS;
  const contracts = p.contracts.filter((c) => TVL_ROLES.has(c.role)).slice(0, 2);

  const parts = await Promise.all(
    contracts.map(async (c) => {
      let sampleUsd = 0;
      let newest = 0;
      let oldest = Number.POSITIVE_INFINITY;
      let coveredFullDay = false;
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
      return { sampleUsd, newest, oldest, coveredFullDay };
    }),
  );

  let sampleUsd = 0;
  let newest = 0;
  let oldest = Number.POSITIVE_INFINITY;
  let coveredFullDay = false;
  for (const p of parts) {
    sampleUsd += p.sampleUsd;
    newest = Math.max(newest, p.newest);
    oldest = Math.min(oldest, p.oldest);
    coveredFullDay = coveredFullDay || p.coveredFullDay;
  }

  let volume24h = sampleUsd;
  if (!coveredFullDay && newest > oldest && Number.isFinite(oldest)) {
    const span = Math.max(newest - oldest, 1);
    volume24h = sampleUsd * (DAY_MS / span);
  }
  const fees24h = p.category === "dex" && volume24h > 0 ? volume24h * 0.003 : undefined;
  return { volume24h, fees24h };
}

async function loadRankings() {
  const rows = await Promise.all(
    protocols.map(async (p) => {
      const [tvlUsd, vol] = await Promise.all([protocolTvl(p), volumeFromTransfers(p)]);
      return {
        slug: p.slug,
        name: p.name,
        category: p.category,
        tvlUsd,
        volume24h: vol.volume24h,
        fees24h: vol.fees24h,
        age: undefined as string | undefined,
        txs: 0,
        transfers: 0,
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

export function getProtocolRankings() {
  return fetchCache("protocol-rankings", loadRankings, RANKINGS_TTL);
}

export type ProtocolRanking = Awaited<ReturnType<typeof getProtocolRankings>>[number];
