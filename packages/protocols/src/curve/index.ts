import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const curve: ProtocolConfig = {
  slug: "curve",
  name: "Curve StableSwap",
  category: "dex",
  description:
    "Curve-style USDC/EURC StableSwap and gauge on Arc Testnet — high transfer and swap activity.",
  feeBps: 4,
  contracts: [
    {
      address: "0x2D84D79C852f6842AbE0304b70bBaA1506AdD457",
      role: "pool",
      label: "USDC/EURC StableSwap",
    },
    {
      address: "0xCd4e6C8056608e7CA5b8cD126F32c56c43D92979",
      role: "gauge",
      label: "USDCEURC Gauge",
    },
    {
      address: "0x0714027e44802b2ff76389daf5371990cc3a4c24",
      role: "pool",
      label: "Curve StableSwap B",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
