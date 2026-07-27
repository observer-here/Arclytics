import { priceUsd } from "./prices";
import { toNumber } from "./decimals";

export interface TokenBalance {
  token: string;
  raw: string | bigint;
  decimals: number;
}

export function sumTvlUsd(balances: TokenBalance[]): number {
  return balances.reduce((total, b) => {
    const amount = toNumber(b.raw, b.decimals);
    return total + amount * priceUsd(b.token);
  }, 0);
}

export function changePct(current: number, previous: number): number | undefined {
  if (!previous) return undefined;
  return ((current - previous) / previous) * 100;
}
