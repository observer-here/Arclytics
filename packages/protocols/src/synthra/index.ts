import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const synthra: ProtocolConfig = {
  slug: "synthra",
  name: "Synthra",
  category: "derivatives",
  description:
    "Spot swaps, concentrated liquidity, and perpetual markets on Arc Testnet.",
  website: "https://app.synthra.org",
  docs: "https://docs.synthra.org",
  feeBps: 5,
  contracts: [
    {
      address: "0xAC36804B4a860C5463F3B89d077a0653AaA9d8F1",
      role: "pool",
      label: "Perpetual Liquidity",
    },
    {
      address: "0xa25499f37BE37C7461634DA343D2C0480cf4911b",
      role: "pool",
      label: "Synthra V3 Pool A",
    },
    {
      address: "0x715f78de0cea7428a5ede4a0c491b05e7a8caff2",
      role: "pool",
      label: "Synthra V3 Pool B",
    },
    {
      address: "0x1c02648cf14ece64afc1af141c177760aec7013a",
      role: "pool",
      label: "Synthra V3 Pool C",
    },
    {
      address: "0xc5494d48b7526d803d00755308b0919834061a49",
      role: "pool",
      label: "Synthra V3 Pool D",
    },
    {
      address: "0x5180f1e23e182850d5489dbf7054337169740edb",
      role: "pool",
      label: "Synthra V3 Pool E",
    },
    {
      address: "0x4301aba1ae52614a3412cac2e1a780e346d2cff9",
      role: "pool",
      label: "Synthra V3 Pool F",
    },
    {
      address: "0xa231458f45727cbfa45c1181b25cccb911ca163a",
      role: "pool",
      label: "Synthra V3 Pool G",
    },
    {
      address: "0xff615e968e1d50980972b2e291571df2aef10919",
      role: "pool",
      label: "Synthra V3 Pool H",
    },
    {
      address: "0x444Cc395346428216fB6f2892eb03cB804aE4CD5",
      role: "factory",
      label: "V3 Position Manager",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
