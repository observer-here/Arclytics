import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const arrowdex: ProtocolConfig = {
  slug: "arrowdex",
  name: "Arrow DEX",
  category: "dex",
  description:
    "Cross-chain exchange on Arc Testnet — USDC/EURC swaps, WUSDC/ARROW liquidity pools, LP staking vaults, and CCTP bridging.",
  website: "https://arrowdex.vercel.app",
  docs: "https://arrowdexdocs.vercel.app",
  feeBps: 30,
  contracts: [
    {
      address: "0x04722Bc000D0257C8e7b364975b4d89c0f36a86d",
      role: "factory",
      label: "ArrowFactory",
    },
    {
      address: "0x847ee9aA98A05d371Be291A95A087FA02E77A416",
      role: "router",
      label: "ArrowSwap",
    },
    {
      address: "0x92318C8845283B9E8A33124Ef4EC520491F826F0",
      role: "pool",
      label: "WUSDC/ARROW Pool",
    },
    {
      address: "0x94D72FdDC5A6bF52968797699dAce54812934765",
      role: "pool",
      label: "Factory Pool",
    },
    {
      address: "0x23B595fcFD75F8fD46FC044220b74a93cdFDd7F9",
      role: "vault",
      label: "ArrowVault",
    },
  ],
  tvlTokens: [
    addresses.usdc,
    addresses.eurc,
    "0x6eE5a47Ae9F0536675041ed900fD3Ef1AA1Dea18",
    "0x92318C8845283B9E8A33124Ef4EC520491F826F0",
  ],
};
