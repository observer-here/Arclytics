import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const sendarc: ProtocolConfig = {
  slug: "sendarc",
  name: "SendArc",
  category: "payments",
  description:
    "SendArc USDC transfer router on Arc Testnet — on-chain attribution for native USDC sends.",
  website: "https://sendarc.xyz",
  feeBps: 0,
  contracts: [
    {
      address: "0x5c1B1aAE195E247FcaF032540093d50855F62372",
      role: "router",
      label: "SendArcRouter",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
