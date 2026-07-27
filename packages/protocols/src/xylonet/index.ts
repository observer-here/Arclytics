import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const xylonet: ProtocolConfig = {
  slug: "xylonet",
  name: "XyloNet",
  category: "yield",
  description:
    "Stablecoin-native DeFi on Arc: StableSwap AMM, CCTP bridge, liquidity pools, and ERC-4626 vaults for USDC and EURC.",
  website: "https://xylonet.xyz",
  docs: "https://www.arc.io/blog/how-xylonet-is-building-stablecoin-defi-and-social-tipping-on-arc",
  feeBps: 4,
  contracts: [
    {
      address: "0x240Eb85458CD41361bd8C3773253a1D78054f747",
      role: "vault",
      label: "USDC Vault",
    },
    {
      address: "0x3DF3966F5138143dce7a9cFDdC2c0310ce083BB1",
      role: "pool",
      label: "USDC-EURC LP",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
