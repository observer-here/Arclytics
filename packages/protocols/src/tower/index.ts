import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const tower: ProtocolConfig = {
  slug: "tower",
  name: "Tower Exchange",
  category: "dex",
  description:
    "Native stablecoin DEX aggregator on Arc with smart routing across liquidity sources.",
  website: "https://tower.exchange",
  feeBps: 30,
  contracts: [
    {
      address: "0xDf115b4f2F22B9255B2E63348423B6C5B379Bce2",
      role: "router",
      label: "TowerRouter",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
