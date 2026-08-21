import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const tella: ProtocolConfig = {
  slug: "tella",
  name: "Tella",
  category: "payments",
  description:
    "WhatsApp stablecoin payments on Arc — send, receive, and cash out USDC by message. Wallets via Circle DCW EOAs.",
  website: "https://www.tella.cash/",
  twitter: "https://www.linkedin.com/company/tellacash",
  feeBps: 0,
  // No public protocol contracts: settlement is per-user Circle DCW EOAs on ARC-TESTNET.
  contracts: [],
  tvlTokens: [addresses.usdc],
};
