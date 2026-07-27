import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const arclp: ProtocolConfig = {
  slug: "arclp",
  name: "Arc USDC/EURC LP",
  category: "dex",
  description: "Arc USDC/EURC liquidity pool on Arc Testnet.",
  feeBps: 4,
  contracts: [
    {
      address: "0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf",
      role: "pool",
      label: "Arc USDC/EURC LP",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
