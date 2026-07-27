import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const aplp: ProtocolConfig = {
  slug: "aplp",
  name: "APLP Pool",
  category: "lending",
  description:
    "PoolToken vault on Arc Testnet with USDC and aToken-style USDC.a balances (APLP liquidity).",
  feeBps: 0,
  contracts: [
    {
      address: "0x97c0194480Adb526194835D2688A333BBE55d770",
      role: "lending_pool",
      label: "PoolToken",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
