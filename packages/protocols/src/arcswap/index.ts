import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const arcswap: ProtocolConfig = {
  slug: "arcswap",
  name: "ArcSwap",
  category: "dex",
  description:
    "Uniswap V2-style swap and liquidity on Arc Testnet — USDC/EURC AMM with router, factory, and live pool.",
  website: "https://arc-swap-dapp.replit.app",
  feeBps: 30,
  contracts: [
    {
      address: "0xb3685D16AAa06361ED28377b1319136650Fa9A13",
      role: "pool",
      label: "USDC/EURC Pair",
    },
    {
      address: "0xe27d5d256b370604f1ff060fb489c6a8e3f8a6d9",
      role: "router",
      label: "UniswapV2Router02",
    },
    {
      address: "0x7483847d46db2920dd64efa676cf72dcf765814f",
      role: "factory",
      label: "UniswapV2Factory",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
