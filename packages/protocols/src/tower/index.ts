import { addresses } from "@arclytics/chain";
import type { ProtocolConfig } from "@arclytics/types";

export const tower: ProtocolConfig = {
  slug: "tower",
  name: "Tower Exchange",
  category: "dex",
  description:
    "Stablecoin DEX aggregator and Uniswap V2 AMM on Arc — USDC, EURC, USDT, and cirBTC pools plus smart routing.",
  website: "https://tower.exchange",
  feeBps: 30,
  contracts: [
    {
      address: "0x2De8906a641d65d490bC60A4179d961d59742bCb",
      role: "router",
      label: "TowerSwapExecutor",
    },
    {
      address: "0xFA4Cc09c073742b7EA534E0B55B8d2BB3089668C",
      role: "pool",
      label: "USDC/EURC",
    },
    {
      address: "0x05efF4C5152178641b3e4A0Bf07D797D2ad9A68F",
      role: "pool",
      label: "USDC/cirBTC",
    },
    {
      address: "0x22512C21A6A651D05D786Caf54Fdfee69205192c",
      role: "pool",
      label: "USDT/USDC",
    },
    {
      address: "0x037d9c33A8C0ddA1FbA65732A2f9b49651e465F1",
      role: "pool",
      label: "USDT/EURC",
    },
    {
      address: "0xfF3353631f6d3F6615E89bA8824F40Bbb5f13cF8",
      role: "pool",
      label: "EURC/cirBTC",
    },
    {
      address: "0x06c73D86a01129Ab177d2BEf0BbD69010B17fC0c",
      role: "pool",
      label: "USDT/cirBTC",
    },
    {
      address: "0x9DE50a654531CD72533098a9c2De4239c121821D",
      role: "factory",
      label: "TowerFactory",
    },
    {
      address: "0xDf115b4f2F22B9255B2E63348423B6C5B379Bce2",
      role: "router",
      label: "TowerRouter",
    },
  ],
  tvlTokens: [addresses.usdc, addresses.eurc, addresses.usdt, addresses.cirBtc],
};
