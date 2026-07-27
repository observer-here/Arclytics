import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const unitflow: ProtocolConfig = {
  slug: "unitflow",
  name: "UnitFlow",
  category: "lending",
  description: "UnitFlow lending pools on Arc Testnet.",
  feeBps: 0,
  contracts: [
    {
      address: "0xb6cbd47e67def8270916a9f756526015fabb2f1b",
      role: "lending_pool",
      label: "UnitFlowLendingPool A",
    },
    {
      address: "0xfd9ead3648a2600052720f335118718738fe67ab",
      role: "lending_pool",
      label: "UnitFlowLendingPool B",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
