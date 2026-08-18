export const details = {
  builder: "Tower Exchange",
  status: "testnet" as const,
  featured: true,
  categoryLabel: "DEX Aggregator",
  summary:
    "Arc Builder Spotlight. Native Uniswap V2 AMM plus routing across Arc DEX liquidity.",
  links: {
    website: "https://tower.exchange",
    analytics: "https://analytics.tower.exchange",
    karma: "https://www.karmahq.xyz/project/tower-exchange",
    showcase:
      "https://community.arc.io/public/forum/boards/ecosystem-showcase-and-launches-pdq/posts/reintroducing-tower-exchange-on-arc-hgmyenl0hg",
  },
  contracts: {
    factory: "0x9DE50a654531CD72533098a9c2De4239c121821D",
    router: "0xDf115b4f2F22B9255B2E63348423B6C5B379Bce2",
    usdcEurc: "0xFA4Cc09c073742b7EA534E0B55B8d2BB3089668C",
    usdcCirBtc: "0x05efF4C5152178641b3e4A0Bf07D797D2ad9A68F",
    usdtUsdc: "0x22512C21A6A651D05D786Caf54Fdfee69205192c",
    usdtEurc: "0x037d9c33A8C0ddA1FbA65732A2f9b49651e465F1",
    eurcCirBtc: "0xfF3353631f6d3F6615E89bA8824F40Bbb5f13cF8",
    usdtCirBtc: "0x06c73D86a01129Ab177d2BEf0BbD69010B17fC0c",
    swapExecutor: "0x2De8906a641d65d490bC60A4179d961d59742bCb",
    recurringOrders: "0x2bECdE5613E3c23549b409F200D012540E612403",
    feeRecipient: "0x6396DfE7949c785Ab8b3e4634d0c9aB97d700a4B",
  },
  sources: ["ArcScan verified TowerFactory/TowerRouter", "Arc House", "Karma"],
};
