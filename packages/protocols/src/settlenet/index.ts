import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const settlenet: ProtocolConfig = {
  slug: "settlenet",
  name: "SettleNet",
  category: "other",
  description:
    "Agent settlement on Arc: escrow settlement, evaluator staking, and provider bonds in USDC.",
  feeBps: 0,
  contracts: [
    {
      address: "0x500AbaccCDb3acF312C6E391955c4b50F465F182",
      role: "vault",
      label: "SettleNet",
    },
    {
      address: "0x9CB6b2DC868683f3E1F8126F368DbA6CC3D7f84b",
      role: "vault",
      label: "EvaluatorStake",
    },
    {
      address: "0x1C8B8A2b1aeb55FCC84117C33F3BB4960122612C",
      role: "vault",
      label: "ProviderBond",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc],
};
