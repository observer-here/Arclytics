import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const perpdex: ProtocolConfig = {
  slug: "perpdex",
  name: "PerpDEX",
  category: "derivatives",
  description: "Perpetual DEX vault (PerpDEXV6) on Arc Testnet holding USDC liquidity.",
  feeBps: 5,
  contracts: [
    {
      address: "0xe181e495d364558a53774b06be135e1a283a42a7",
      role: "vault",
      label: "PerpDEXV6",
    },
    {
      address: "0x8eec82f219b4df75a1ba9083e6c1d43ea60173d3",
      role: "pool",
      label: "PerpDEX LP",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
