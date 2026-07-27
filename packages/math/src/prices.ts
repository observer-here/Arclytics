import { addresses } from "@arclytics/chain";

const STABLE_USD: Record<string, number> = {
  [addresses.usdc.toLowerCase()]: 1,
  [addresses.eurc.toLowerCase()]: 1.08,
  [addresses.usyc.toLowerCase()]: 1,
};

export function priceUsd(token: string, fallback = 0): number {
  return STABLE_USD[token.toLowerCase()] ?? fallback;
}
