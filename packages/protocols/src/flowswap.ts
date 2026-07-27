import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const flowswap: ProtocolConfig = {
  slug: "flowswap",
  name: "FlowSwap",
  category: "dex",
  contracts: [
    {
      address: "0x49f9636FE15883e16d5E356A4eA08C9Fe6BC219B",
      role: "router",
      label: "FlowSwapAMM",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
