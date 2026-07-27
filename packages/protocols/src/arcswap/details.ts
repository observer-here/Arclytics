export const details = {
  builder: "ArcSwap",
  status: "testnet" as const,
  featured: false,
  categoryLabel: "DEX",
  summary:
    "Token swap + liquidity DApp on Arc Testnet using self-deployed Uniswap V2 contracts.",
  links: {
    website: "https://arc-swap-dapp.replit.app",
    github: "https://github.com/osr21/arc-swap",
  },
  contracts: {
    factory: "0x7483847d46db2920dd64efa676cf72dcf765814f",
    router: "0xe27d5d256b370604f1ff060fb489c6a8e3f8a6d9",
    pair: "0xb3685D16AAa06361ED28377b1319136650Fa9A13",
  },
  sources: ["ArcScan", "GitHub circlefin/arc-node discussion"],
};
