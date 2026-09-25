export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  slug: "arc-testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: "https://rpc.testnet.arc.network",
    websocket: "wss://rpc.testnet.arc.network",
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
      api: "https://testnet.arcscan.app/api/v2",
    },
  },
  testnet: true,
} as const;
