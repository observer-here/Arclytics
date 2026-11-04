export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  slug: "arc-testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: "https://rpc.testnet.arc.io",
    websocket: "wss://rpc.testnet.arc.io",
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://explorer.testnet.arc.io",
      api: "https://explorer.testnet.arc.io/api/v2",
    },
  },
  testnet: true,
} as const;
