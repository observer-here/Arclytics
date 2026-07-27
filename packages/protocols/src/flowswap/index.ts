import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const flowswap: ProtocolConfig = {
  slug: "flowswap",
  name: "FlowSwap",
  category: "dex",
  description:
    "DEX AMM on Arc for swapping and providing liquidity across stablecoin and token pairs.",
  website: "https://flowswap.xyz",
  feeBps: 30,
  contracts: [
    {
      address: "0x49f9636FE15883e16d5E356A4eA08C9Fe6BC219B",
      role: "router",
      label: "FlowSwapAMM",
    },
    {
      address: "0x626556a164918231bc9f73dac17a5bc07d3865cf",
      role: "lending_pool",
      label: "FlowLendingPool",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
