import { useParams } from "react-router-dom";
import { MetricCard } from "@/components/ecosystem/MetricCard";
import { Icons } from "@/components/shared/Icons";
import { TokenIcon } from "@/components/shared/TokenIcon";
import {
  AMM_LABEL,
  TOKEN_CATEGORY_PILL,
  tokenMeta,
} from "@/config/tokens";
import { useAsyncData } from "@/hooks/useAsyncData";
import { arcscan } from "@/libs/arcscan";
import { lpPriceFromReserves, spotPriceFromPool } from "@/libs/lpPrice";
import { ago, compact, shortHash, usd } from "@/utils/format";

export function TokenDetailPage() {
  const { address = "" } = useParams();
  const meta = tokenMeta(address);

  const { data, loading, error } = useAsyncData(
    `token-detail-v2:${address.toLowerCase()}`,
    async () => {
      const [token, counters, holders, transfers] = await Promise.all([
        arcscan.token(address).catch(() => null),
        arcscan.tokenCounters(address).catch(() => null),
        arcscan.tokenHolders(address).catch(() => ({ items: [] as Array<Record<string, unknown>> })),
        arcscan.tokenTransfers(address).catch(() => ({ items: [] as Array<Record<string, unknown>> })),
      ]);
      if (!token || (token as { message?: string }).message) return null;

      const rate = token.exchange_rate != null ? Number(token.exchange_rate) : null;
      let price: number | null =
        rate != null && Number.isFinite(rate) && rate > 0 ? rate : null;
      let tvlUsd: number | null = null;
      let marketCap: number | null =
        token.circulating_market_cap != null && Number(token.circulating_market_cap) > 0
          ? Number(token.circulating_market_cap)
          : null;

      if (price == null && meta?.fromReserves) {
        const lp = await lpPriceFromReserves(address);
        price = lp.price;
        tvlUsd = lp.tvlUsd || null;
        if (price != null && lp.supply > 0) marketCap = price * lp.supply;
      }
      if (price == null && meta?.spotPool) {
        const spot = await spotPriceFromPool(address, meta.spotPool);
        price = spot.price;
        tvlUsd = spot.tvlUsd || null;
        const dec = Number(token.decimals ?? 18);
        const supply = Number(token.total_supply ?? 0) / 10 ** dec;
        if (price != null && supply > 0) marketCap = price * supply;
      }
      if (price == null && meta?.pegUsd) price = 1;

      const holdersCount = Number(counters?.token_holders_count ?? token.holders_count ?? 0);
      const transfersCount = Number(counters?.transfers_count ?? 0);
      const dec = Number(token.decimals ?? 18);
      const supply = Number(token.total_supply ?? 0) / 10 ** dec;

      return {
        token,
        price,
        marketCap,
        tvlUsd,
        holdersCount,
        transfersCount,
        supply: Number.isFinite(supply) ? supply : 0,
        holders: holders.items ?? [],
        transfers: transfers.items ?? [],
      };
    },
    [address],
  );

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;
  if (!data) {
    return <div className="rounded-lg border border-ink-200 bg-white p-6 text-ink-500">Token not found.</div>;
  }

  const { token, price, marketCap, tvlUsd, holdersCount, transfersCount, supply, holders, transfers } =
    data;
  const symbol = String(token.symbol ?? "");
  const name = String(token.name ?? symbol);
  const iconUrl = token.icon_url ? String(token.icon_url) : undefined;

  return (
    <div className="space-y-2.5">
      <div className="rounded-lg border border-ink-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <TokenIcon address={address} src={iconUrl} symbol={symbol} size={44} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold text-ink-900">
                  {name} <span className="text-ink-400">({symbol})</span>
                </h1>
                {meta && (
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-medium ${TOKEN_CATEGORY_PILL[meta.category]}`}
                  >
                    {meta.category}
                  </span>
                )}
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-ink-400">{address}</div>
              {meta?.blurb && (
                <div className="mt-1.5 text-[12px] text-ink-500">{meta.blurb}</div>
              )}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-ink-400">Price</div>
            <div className="text-xl font-semibold text-ink-900">
              {price != null ? usd(price) : "—"}
            </div>
            {meta && (
              <div className="mt-1 text-[11px] text-ink-500">
                {meta.protocol} · {AMM_LABEL[meta.amm]}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Holders" value={compact(holdersCount)} icon={<Icons.Users size={13} />} color="#f59e0b" />
        <MetricCard label="Transfers" value={compact(transfersCount)} icon={<Icons.Volume size={13} />} color="#8b5cf6" />
        <MetricCard label="Market Cap" value={marketCap != null ? usd(marketCap) : "—"} icon={<Icons.Tvl size={13} />} color="#2563eb" />
        <MetricCard label="Supply" value={supply > 0 ? compact(supply) : "—"} icon={<Icons.Tokens size={13} />} color="#06b6d4" />
        <MetricCard label="Pool TVL" value={tvlUsd != null && tvlUsd > 0 ? usd(tvlUsd) : "—"} icon={<Icons.DeFi size={13} />} color="#10b981" />
        <MetricCard label="Decimals" value={String(token.decimals ?? "—")} icon={<Icons.Layers size={13} />} color="#64748b" />
      </div>

      <div className="grid gap-2 xl:grid-cols-2">
        <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
          <div className="border-b border-ink-100 px-3 py-2 text-[13px] font-semibold text-ink-900">
            Top Holders
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-ink-400">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Address</th>
                <th className="px-3 py-2 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {holders.slice(0, 10).map((h, i) => {
                const addr = String(
                  (h.address as { hash?: string } | undefined)?.hash ?? h.address_hash ?? "",
                );
                const dec = Number(
                  (h.token as { decimals?: string } | undefined)?.decimals ?? token.decimals ?? 18,
                );
                const bal = Number(h.value ?? 0) / 10 ** dec;
                return (
                  <tr key={`${addr}-${i}`} className="border-t border-ink-100">
                    <td className="px-3 py-2 text-ink-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <a
                        href={`https://testnet.arcscan.app/address/${addr}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] text-arc-700 hover:underline"
                      >
                        {shortHash(addr, 8, 6)}
                      </a>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-ink-800">
                      {Number.isFinite(bal) ? compact(bal) : "—"}
                    </td>
                  </tr>
                );
              })}
              {!holders.length && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-ink-400">
                    No holders indexed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="overflow-hidden rounded-lg border border-ink-200 bg-white">
          <div className="border-b border-ink-100 px-3 py-2 text-[13px] font-semibold text-ink-900">
            Recent Transfers
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] text-ink-400">
                <th className="px-3 py-2 font-medium">Tx</th>
                <th className="px-3 py-2 font-medium">From → To</th>
                <th className="px-3 py-2 text-right font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {transfers.slice(0, 10).map((tx, i) => {
                const hash = String(tx.transaction_hash ?? tx.tx_hash ?? "");
                const from = String((tx.from as { hash?: string } | undefined)?.hash ?? "");
                const to = String((tx.to as { hash?: string } | undefined)?.hash ?? "");
                const ts = String(tx.timestamp ?? "");
                return (
                  <tr key={`${hash}-${i}`} className="border-t border-ink-100">
                    <td className="px-3 py-2">
                      <a
                        href={`https://testnet.arcscan.app/tx/${hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[12px] text-arc-700 hover:underline"
                      >
                        {shortHash(hash)}
                      </a>
                    </td>
                    <td className="px-3 py-2 font-mono text-[11px] text-ink-500">
                      {shortHash(from, 6, 4)} → {shortHash(to, 6, 4)}
                    </td>
                    <td className="px-3 py-2 text-right text-[12px] text-ink-500">
                      {ts ? ago(ts) : "—"}
                    </td>
                  </tr>
                );
              })}
              {!transfers.length && (
                <tr>
                  <td colSpan={3} className="px-3 py-8 text-center text-ink-400">
                    No transfers indexed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {meta?.spotPool && (
        <div className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-[12px] text-ink-500">
          Spot priced from pool{" "}
          <a
            href={`https://testnet.arcscan.app/address/${meta.spotPool}`}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-arc-700 hover:underline"
          >
            {shortHash(meta.spotPool, 10, 8)}
          </a>
        </div>
      )}
    </div>
  );
}
