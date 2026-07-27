import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const lunex: ProtocolConfig = {
  slug: "lunex",
  name: "Lunex",
  category: "yield",
  description:
    "Curve-style StableSwap AMM and ERC-4626 vaults for USDC/EURC on Arc Testnet.",
  website: "https://lunexonarc.vercel.app",
  docs: "https://github.com/linoxbt/Lunex-on-Arc",
  feeBps: 4,
  contracts: [
    {
      address: "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8",
      role: "pool",
      label: "StableSwapPool",
    },
    {
      address: "0x66CF9CA9D75FD62438C6E254bA35E61775EF9496",
      role: "vault",
      label: "USDC Vault",
    },
    {
      address: "0xcF2C839B12ECf6D9eEcd4607521B73fcFb7E8713",
      role: "vault",
      label: "EURC Vault",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
