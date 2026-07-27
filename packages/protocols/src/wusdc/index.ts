import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const wusdc: ProtocolConfig = {
  slug: "wusdc",
  name: "WUSDC",
  category: "other",
  description:
    "Wrapped USDC on Arc Testnet — high-activity wrapper contract holding native USDC reserves.",
  feeBps: 0,
  contracts: [
    {
      address: "0x911b4000D3422F482F4062a913885f7b035382Df",
      role: "vault",
      label: "WUSDC",
    },
    {
      address: "0xde5db9049a8dd344dc1b7bbb098f9da60930a6da",
      role: "vault",
      label: "Wrapped USDC",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
