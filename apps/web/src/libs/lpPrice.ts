import { RESERVE_USD } from "@arclytics/chain";
import { arcscan } from "@/libs/arcscan";

type TokBal = {
  value?: string | number;
  token?: { address_hash?: string; decimals?: string; symbol?: string };
};

function balUsd(items: TokBal[]) {
  let pricedUsd = 0;
  let pricedLegs = 0;
  let unpricedLegs = 0;
  for (const item of items) {
    const addr = (item.token?.address_hash ?? "").toLowerCase();
    const dec = Number(item.token?.decimals ?? 18);
    const amt = Number(item.value ?? 0) / 10 ** dec;
    if (!Number.isFinite(amt) || amt <= 0) continue;
    const px = RESERVE_USD[addr];
    if (px != null) {
      pricedUsd += amt * px;
      pricedLegs += 1;
    } else unpricedLegs += 1;
  }
  let tvlUsd = pricedUsd;
  if (pricedUsd > 0 && unpricedLegs > 0 && pricedLegs === 1) tvlUsd = pricedUsd * 2;
  return { pricedUsd, tvlUsd };
}

/**
 * LP / vault share: price = TVL_usd / totalSupply
 * UniV2 with one priced leg uses 2× priced leg (50/50).
 */
export async function lpPriceFromReserves(address: string): Promise<{
  price: number | null;
  tvlUsd: number;
  supply: number;
}> {
  const [tok, bals] = await Promise.all([
    arcscan.token(address).catch(() => null),
    arcscan.addressTokens(address).catch(() => ({ items: [] as TokBal[] })),
  ]);
  if (!tok || (tok as { message?: string }).message) {
    return { price: null, tvlUsd: 0, supply: 0 };
  }

  const decimals = Number(tok.decimals ?? 18);
  const rawSupply = Number(tok.total_supply ?? 0);
  const supply = Number.isFinite(rawSupply) ? rawSupply / 10 ** decimals : 0;
  const { tvlUsd } = balUsd((bals.items ?? []) as TokBal[]);

  if (!Number.isFinite(supply) || supply < 1e-8 || tvlUsd <= 0) {
    return { price: null, tvlUsd, supply };
  }

  const price = tvlUsd / supply;
  if (!Number.isFinite(price) || price <= 0 || price > 1e9) {
    return { price: null, tvlUsd, supply };
  }
  return { price, tvlUsd, supply };
}

/** Spot token price from a USDC (or EURC) pool: priced_reserve / token_reserve */
export async function spotPriceFromPool(
  tokenAddress: string,
  poolAddress: string,
): Promise<{ price: number | null; tvlUsd: number }> {
  const bals = await arcscan
    .addressTokens(poolAddress)
    .catch(() => ({ items: [] as TokBal[] }));
  const items = (bals.items ?? []) as TokBal[];
  const token = tokenAddress.toLowerCase();

  let tokenAmt = 0;
  let pricedUsd = 0;
  for (const item of items) {
    const addr = (item.token?.address_hash ?? "").toLowerCase();
    const dec = Number(item.token?.decimals ?? 18);
    const amt = Number(item.value ?? 0) / 10 ** dec;
    if (!Number.isFinite(amt) || amt <= 0) continue;
    if (addr === token) tokenAmt = amt;
    const px = RESERVE_USD[addr];
    if (px != null) pricedUsd += amt * px;
  }

  if (tokenAmt <= 0 || pricedUsd <= 0) return { price: null, tvlUsd: pricedUsd * 2 };
  const price = pricedUsd / tokenAmt;
  if (!Number.isFinite(price) || price <= 0 || price > 1e9) {
    return { price: null, tvlUsd: pricedUsd * 2 };
  }
  return { price, tvlUsd: pricedUsd * 2 };
}
