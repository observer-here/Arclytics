import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const warpdex: ProtocolConfig = {
  slug: "warpdex",
  name: "WarpDex",
  category: "dex",
  description: "WarpDex liquidity pool on Arc Testnet.",
  feeBps: 30,
  contracts: [
    {
      address: "0xc6b602bdb645b1c41a7fa78a3c942abc55b0c1b5",
      role: "pool",
      label: "WarpDex LP",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
