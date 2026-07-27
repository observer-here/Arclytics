import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const defiOnArc: ProtocolConfig = {
  slug: "defi-on-arc",
  name: "DeFi on ARC",
  category: "dex",
  description:
    "Community DEX on Arc Testnet by chriswilder.eth — swap, liquidity pools, and farming for USDC pairs.",
  website: "https://defi-on-arc.org",
  twitter: "https://x.com/realchriswilder",
  feeBps: 30,
  contracts: [
    {
      address: "0x284C5Afc100ad14a458255075324fA0A9dfd66b1",
      role: "router",
      label: "Router",
    },
    {
      address: "0x34A0b64a88BBd4Bf6Acba8a0Ff8F27c8aDD67E9C",
      role: "factory",
      label: "Factory",
    },
    {
      address: "0xd065a783C362d73b5a62EfB2B2e5DEDe49d16aa3",
      role: "pool",
      label: "SRAC/USDC Pool",
    },
    {
      address: "0xFabB12B18c4b0B79dd97D8EA7c000F7424C76195",
      role: "pool",
      label: "KITTY/USDC Pool",
    },
    {
      address: "0xa7Eb57a1538BC8ca2F0452954610A7d6f1F0242B",
      role: "pool",
      label: "DOGG/USDC Pool",
    },
    {
      address: "0x55b9CbF50dc1171526635d03267f4A0979f1fFBb",
      role: "pool",
      label: "RACS/USDC Pool",
    },
    {
      address: "0xFDC1F922f7065602F06504d62E314A1cEe72c189",
      role: "pool",
      label: "SACS/USDC Pool",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
