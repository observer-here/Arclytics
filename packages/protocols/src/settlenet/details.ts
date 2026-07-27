export const details = {
  builder: "SettleNet",
  status: "testnet" as const,
  featured: false,
  categoryLabel: "Agent Settlement",
  summary:
    "USDC settlement escrow with evaluator stake and provider bond contracts on Arc Testnet.",
  contracts: {
    settleNet: "0x500AbaccCDb3acF312C6E391955c4b50F465F182",
    evaluatorStake: "0x9CB6b2DC868683f3E1F8126F368DbA6CC3D7f84b",
    providerBond: "0x1C8B8A2b1aeb55FCC84117C33F3BB4960122612C",
  },
  sources: ["ArcScan"],
};
