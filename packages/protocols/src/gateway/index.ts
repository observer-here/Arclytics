import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const gateway: ProtocolConfig = {
  slug: "gateway",
  name: "Circle Gateway",
  category: "bridge",
  description:
    "Circle Gateway Wallet on Arc Testnet — unified USDC balance / cross-chain gateway liquidity.",
  website: "https://developers.circle.com",
  docs: "https://developers.circle.com",
  contracts: [
    {
      address: addresses.gateway.wallet,
      role: "bridge",
      label: "GatewayWallet",
    },
    {
      address: addresses.gateway.minter,
      role: "bridge",
      label: "GatewayMinter",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
