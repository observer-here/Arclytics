import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const cctp: ProtocolConfig = {
  slug: "cctp",
  name: "Circle CCTP",
  category: "bridge",
  website: "https://developers.circle.com/cctp",
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
