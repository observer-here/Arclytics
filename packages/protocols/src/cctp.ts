import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const cctp: ProtocolConfig = {
  slug: "cctp",
  name: "Circle CCTP",
  category: "bridge",
  description:
    "Circle CCTP enables native USDC burns and mints across chains, bridging value into and out of Arc Testnet.",
  website: "https://developers.circle.com/cctp",
  docs: "https://developers.circle.com/cctp",
  contracts: [
    {
      address: addresses.cctp.tokenMessengerV2,
      role: "other",
      label: "TokenMessengerV2",
    },
    {
      address: addresses.cctp.messageTransmitterV2,
      role: "other",
      label: "MessageTransmitterV2",
    },
  ],
  tvlTokens: [addresses.usdc],
};
