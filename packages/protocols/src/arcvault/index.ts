import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const arcvault: ProtocolConfig = {
  slug: "arcvault",
  name: "ArcVault",
  category: "yield",
  description: "ArcVault yield vault holding USDC on Arc Testnet.",
  feeBps: 0,
  contracts: [
    {
      address: "0xe5f41fa47cb6253750909fea73a3e4d049df921c",
      role: "vault",
      label: "ArcVault",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
