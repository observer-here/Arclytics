import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const payx: ProtocolConfig = {
  slug: "payx",
  name: "PayX",
  category: "payments",
  description:
    "USDC social tipping on X. Tips escrow to handles until recipients verify and claim.",
  website: "https://xylonet.xyz/payx",
  docs: "https://xylonet.xyz/payx/docs",
  twitter: "https://x.com",
  discord: "https://discord.gg/mcDkHNrFyA",
  feeBps: 100,
  contracts: [
    {
      address: "0xA312c384770B7b49E371DF4b7AF730EFEF465913",
      role: "vault",
      label: "PayXTipping",
    },
  ],
  tvlTokens: [addresses.usdc],
};
