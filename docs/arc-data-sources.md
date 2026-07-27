# Arclytics — Arc Data Sources Reference

Living reference for official Arc / Circle / ArcScan / indexer endpoints.  
Use this when wiring KPIs, charts, protocol metrics, bridges, and live feeds.

**Network:** Arc Testnet · Chain ID `5042002` (`0x4cef52`)  
**Explorer:** https://testnet.arcscan.app  
**Docs:** https://docs.arc.io · MCP: Arc Docs  
**Last researched:** 2026-07-27

---

## 1. Chain metadata (official)

| Property | Value |
|----------|--------|
| Chain ID | `5042002` |
| Currency | USDC (gas) |
| RPC HTTP | `https://rpc.testnet.arc.network` |
| RPC WSS | `wss://rpc.testnet.arc.network` |
| Alt host | `https://rpc.testnet.arc.io` / `wss://rpc.testnet.arc.io` |
| Explorer | https://testnet.arcscan.app |
| Gas tracker | https://testnet.arcscan.app/gas-tracker |
| Faucet | https://faucet.circle.com |
| Status | https://status.arc.io |
| CCTP domain | `26` |
| EVM target | Osaka hard fork |

### Core contract addresses (Testnet)

| Asset / contract | Address | Notes |
|------------------|---------|--------|
| USDC (ERC-20) | `0x3600000000000000000000000000000000000000` | 6 decimals; native gas related — do not mix 6 vs 18 |
| Native USDC system | `0xfffffffffffffffffffffffffffffffffffffffe` | EIP-7708 Transfer (18 decimals) |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` | 6 decimals |
| USYC | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` | 6 decimals |
| USYC Entitlements | `0xcc205224862c7641930c87679e98999d23c26113` | |
| USYC Teller | `0x9fdF14c5B14173D74C08Af27AebFf39240dC105A` | |
| Memo | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | |
| TokenMessengerV2 (CCTP) | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` | `DepositForBurn` |
| MessageTransmitterV2 | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` | `MessageReceived` |

Docs: https://docs.arc.io/arc/references/contract-addresses  
Indexing events: https://docs.arc.io/integrate/infrastructure/indexing-events

---

## 2. JSON-RPC / WebSocket (fastest live data)

### Providers

| Provider | HTTP | WebSocket |
|----------|------|-----------|
| Circle primary | `https://rpc.testnet.arc.network` | `wss://rpc.testnet.arc.network` |
| Blockdaemon | `https://rpc.blockdaemon.testnet.arc.network` | `wss://rpc.blockdaemon.testnet.arc.network:443/websocket` |
| dRPC | `https://rpc.drpc.testnet.arc.network` | `wss://rpc.drpc.testnet.arc.network` |
| QuickNode | `https://rpc.quicknode.testnet.arc.network` | `wss://rpc.quicknode.testnet.arc.network` |
| Alchemy | Managed (see Alchemy Arc docs) | Yes |

Docs: https://docs.arc.io/arc/references/rpc-endpoints · https://docs.arc.io/arc/tools/node-providers

### Methods Arclytics cares about

| Method | Use |
|--------|-----|
| `eth_blockNumber` | Tip height |
| `eth_getBlockByNumber` | Blocks + txs (live feed) |
| `eth_subscribe("newHeads")` | Real-time blocks (sub-second) |
| `eth_getLogs` | Event backfill (batch ~1000 blocks) — TVL/volume history |
| `eth_call` / multicall | Vault/token balances without ArcScan |
| `eth_getBalance` | Native USDC balance |
| `eth_gasPrice` / fee fields | Gas KPIs |

**Important:** Arc has deterministic finality → no reorg handling needed.  
Public RPC may rate-limit → prefer paid provider or self-hosted node for production.

### Currently used in project (`apps/web/src/libs/arcRpc.ts`)

- `eth_blockNumber`
- `eth_getBlockByNumber`
- `eth_subscribe` / `newHeads`

---

## 3. ArcScan Blockscout REST — `/api/v2`

**Base:** `https://testnet.arcscan.app/api/v2`  
**Dev proxy:** `/arcscan` → `/api/v2`  
**API docs UI:** https://testnet.arcscan.app/api-docs  
**Backend version (observed):** `v11.2.3`

### Used in Arclytics today (`arcscan.ts`)

| Path | Client method | Purpose |
|------|---------------|---------|
| `/stats` | `stats()` | KPI totals |
| `/stats/charts/transactions` | `txChart()` | Daily txs |
| `/tokens?type=` | `tokens()` | ERC-20 / ERC-721 lists |
| `/tokens/{address}` | `token()` | Token detail + `icon_url`, `holders_count` |
| `/main-page/blocks` | `mainPageBlocks()` | Sidebar / overview |
| `/blocks` | `blocksPage()` | Explorer blocks |
| `/transactions` | `recentTransactions()` / `transactionsPage()` | Tx lists |
| `/transactions/{hash}` | `transaction()` | Tx detail / creation time |
| `/search/quick?q=` | `search()` | Global search |
| `/addresses/{address}` | `address()` | Address info |
| `/addresses/{address}/tokens` | `addressTokens()` | Protocol TVL |
| `/addresses/{address}/counters` | `addressCounters()` | Tx/transfer counts |
| `/addresses/{address}/token-transfers` | `addressTokenTransfers()` | Volume sampling |
| `/addresses/{address}/transactions` | `addressTransactions()` | Protocol recent txs |
| `/smart-contracts/counters` | `smartContractCounters()` | Total contracts KPI |

### High-value unused `/api/v2` (probe-verified 200)

| Path | Why use it |
|------|------------|
| `/tokens/{addr}/counters` | Fast `token_holders_count` + `transfers_count` (USDC: ~4.1M holders, ~505M transfers) |
| `/tokens/{addr}/holders` | Holder leaderboard |
| `/tokens/{addr}/transfers` | Stablecoin flow / volume proxy |
| `/main-page/transactions` | Homepage txs (short list) |
| `/main-page/indexing-status` | Indexer health badge |
| `/config/backend-version` | Version pin |
| `/addresses` | Top addresses by balance |
| `/smart-contracts` | Verified contracts browser |

### Token image field

- Field: `icon_url` on token objects (often CoinGecko CDN)
- Example USDC: `https://assets.coingecko.com/coins/images/6319/small/usdc.png?...`
- Wired via `TokenIcon` + `iconUrl` mapping

### Etherscan-compat module API

- Base: `https://testnet.arcscan.app/api?module=…&action=…`
- Example: `module=stats&action=ethsupply` → works but limited value on Arc
- Prefer `/api/v2` + stats-service

---

## 4. ArcScan Stats Service — `/stats-service/api/v1`

**Base:** `https://testnet.arcscan.app/stats-service/api/v1`  
**Dev proxy:** `/arcstats` → `/stats-service/api/v1`

### Currently used: **1 endpoint only**

| Path | Purpose |
|------|---------|
| `/lines/newAccounts` | New Addresses chart |

### `/counters` — 18 pre-aggregated KPIs (USE THESE)

| id | Title | Notes |
|----|-------|--------|
| `averageBlockTime` | Average block time | seconds |
| `completedTxns` | Completed txns | |
| `lastNewContracts` | Contracts today | |
| `lastNewVerifiedContracts` | Verified contracts today | |
| `totalAccounts` | Total accounts | **~2.9M — matches newAccounts sum** |
| `totalAddresses` | Total addresses | **~46M — matches `/api/v2/stats`** |
| `totalBlocks` | Total blocks | |
| `totalContracts` | Total contracts | |
| `totalNativeCoinTransfers` | Total USDC transfers | |
| `totalTokens` | Total tokens | |
| `totalTxns` | Total txns | |
| `totalUserOps` | Total user operations | ERC-4337 |
| `totalAccountAbstractionWallets` | Total AA wallets | |
| `totalVerifiedContracts` | Total verified contracts | |
| `newTxns24h` | Transactions (24h) | |
| `pendingTxns30m` | Pending transactions (30m) | |
| `txnsFee24h` | Transaction fees (24h) | USDC |
| `averageTxnFee24h` | Avg. transaction fee (24h) | USDC |

### Critical: Accounts vs Addresses

| Metric | Source | Approx value | Meaning |
|--------|--------|-------------:|---------|
| Total Addresses | `/api/v2/stats` → `total_addresses` OR counters `totalAddresses` | **~46M** | Lifetime addresses in DB |
| Total Accounts | counters `totalAccounts` OR `accountsGrowth` last / sum(`newAccounts`) | **~2.9M** | Account growth series |

**They are different ArcScan concepts.**  
New Addresses chart “All” sum ≈ `totalAccounts`, **not** `totalAddresses`.  
Do not treat this as an API bug without acknowledging that distinction.

### `/lines` — chart IDs (all available)

**Accounts:** `accountsGrowth`, `activeAccounts`, `newAccounts`  
**Transactions:** `averageTxnFee`, `newTxns`, `txnsFee`, `txnsGrowth`, `txnsSuccessRate`  
**Blocks:** `averageBlockSize`, `newBlocks`  
**Tokens:** `newNativeCoinTransfers` (USDC transfers)  
**Gas:** `averageGasLimit`, `averageGasPrice`, `gasUsedGrowth`, `networkUtilization`, `averageGasUsed`  
**Contracts:** `contractsGrowth`, `newContracts`, `newVerifiedContracts`, `verifiedContractsGrowth`  
**User ops:** `userOpsGrowth`, `newUserOps`, `newAccountAbstractionWallets`, `accountAbstractionWalletsGrowth`, `activeAccountAbstractionWallets`, `activeBundlers`, `activePaymasters`

Query: `GET /lines/{name}?resolution=DAY|WEEK|MONTH|YEAR`

### `/pages/*` — one-shot page KPIs

| Path | Useful fields |
|------|----------------|
| `/pages/main` | `total_addresses`, `total_blocks`, `total_transactions`, `daily_new_transactions`, `yesterday_transactions`, … |
| `/pages/transactions` | `transactions_24h`, `transactions_fee_24h`, `average_transactions_fee_24h`, `pending_transactions_30m` |
| `/pages/contracts` | `total_contracts`, `new_contracts_24h`, `total_verified_contracts`, `new_verified_contracts_24h` |

Also: `/update-status`, `/lines` (catalog)

### Not available on v2

- `/api/v2/stats/charts/accounts` → **400** (no v2 accounts chart)
- Address time-series only via stats-service lines

---

## 5. Circle / Arc product APIs

| Product | Docs | Arclytics use |
|---------|------|----------------|
| CCTP | https://developers.circle.com/cctp | Bridge volume, domain `26`, attestations |
| Gateway / Unified Balance | https://developers.circle.com/gateway | Crosschain USDC metrics |
| App Kit | https://docs.arc.io/app-kit | Wallet / balance / bridge UX |
| Circle Wallets API | `https://api.circle.com/v1/w3s/…` | Deploy/sign (not core analytics) |
| Faucet | https://faucet.circle.com | Testnet funding only |

---

## 6. Official data indexers (more history, faster queries)

Docs: https://docs.arc.io/arc/tools/data-indexers

| Provider | Product | Best for |
|----------|---------|----------|
| Envio | HyperIndex | Custom GraphQL for protocol events |
| Goldsky | Subgraphs + Mirror | Stream events → DB (sub-second) |
| The Graph | Subgraphs | DEX / pool analytics |
| Thirdweb | Insight | Enriched chain reads |

**Recommendation:** For DefiLlama-style TVL/volume history, prefer Goldsky Mirror or Envio over scraping ArcScan pagination.

---

## 7. Oracles (prices / FX)

Docs: https://docs.arc.io/arc/tools/oracles

- Chainlink — Data Feeds / Streams  
- Chronicle — DeFi prices + proof of asset  
- Pyth — low-latency prices  
- RedStone — modular feeds  

Use for EURC FX and non-$1 pricing (today Arclytics hardcodes stable `$1`).

---

## 8. Priority roadmap for Arclytics

### P0 — wire now (high impact, low effort)

1. Stats-service `/counters` + `/pages/main` for dashboard KPIs  
2. Label **Total Addresses** vs **Total Accounts** correctly  
3. Charts: `activeAccounts`, `newTxns`, `txnsFee`, `newNativeCoinTransfers` (replace fake Volume Proxy)  
4. `/tokens/{usdc|eurc|usyc}/counters` + `/transfers` for stablecoin page  

### P1 — faster / more reliable

5. RPC failover (dRPC / QuickNode) beside primary  
6. Keep WSS `newHeads` for live txs/blocks  
7. `eth_getLogs` backfill for protocol vaults / CCTP  

### P2 — protocol-grade data

8. Envio or Goldsky Mirror for historical TVL/volume  
9. Circle CCTP attestation APIs for bridge analytics  
10. Oracle feeds for EURC / FX  

---

## 9. Env vars (web app)

| Var | Default (prod) |
|-----|----------------|
| `VITE_ARCSCAN_BASE_URL` | `https://testnet.arcscan.app/api/v2` |
| `VITE_ARCSCAN_STATS_URL` | `https://testnet.arcscan.app/stats-service/api/v1` |
| `VITE_ARC_RPC_URL` | `https://rpc.testnet.arc.network` |
| `VITE_ARC_WS_URL` | `wss://rpc.testnet.arc.network` |

Dev proxies (Vite): `/arcscan`, `/arcstats`, `/arcrpc`

---

## 10. Code map

| File | Role |
|------|------|
| `apps/web/src/libs/arcscan.ts` | ArcScan v2 + stats-service client |
| `apps/web/src/libs/arcRpc.ts` | JSON-RPC + WSS live feed |
| `apps/web/src/libs/dashboard.ts` | Dashboard aggregation |
| `apps/web/src/libs/protocolMetrics.ts` | Protocol TVL/volume |
| `apps/web/src/libs/protocolDetail.ts` | Protocol detail page data |
| `apps/web/src/libs/prefetch.ts` | Route prefetch loaders |
| `packages/chain/src/addresses.ts` | Canonical token/CCTP addresses |

---

## 11. Quick copy — complaint / clarification (addresses)

If discussing ArcScan totals with DDC:

> ArcScan exposes both `totalAddresses` (~46M via `/api/v2/stats` and stats-service counters) and `totalAccounts` (~2.9M via counters / `accountsGrowth` / sum of `newAccounts`). Please confirm the official definition of each and whether product UIs should label them separately.

---

## 12. Sources

- https://docs.arc.io/arc/references/rpc-endpoints  
- https://docs.arc.io/arc/tools/node-providers  
- https://docs.arc.io/arc/tools/data-indexers  
- https://docs.arc.io/arc/tools/oracles  
- https://docs.arc.io/arc/references/contract-addresses  
- https://docs.arc.io/integrate/infrastructure/indexing-events  
- https://testnet.arcscan.app/api-docs  
- Live probes: `/api/v2/*`, `/stats-service/api/v1/*` (2026-07-27)

---

## 13. Throttle / probe results (2026-07-27)

Method: ~300–400ms delay between calls (except burst test). No API keys.

### Rate limits
- Stats-service burst **10× `/counters` no delay** → **10/10 OK**, avg **~248ms**
- With 350–400ms spacing, **0 failures** across stats lines + v2 probes
- Public endpoints appear usable for dashboard polling; still add backoff for production

### Stats-service (32 endpoints) — all **200 OK**
| Group | Latency | Payload |
|-------|--------:|--------:|
| `/counters`, `/pages/*`, `/lines` catalog | ~220–480ms | 0.3–5 KB |
| Each `/lines/{name}` (~320 daily points) | ~350–410ms | ~17–25 KB |

### ArcScan v2 — results
| Status | Endpoints |
|--------|-----------|
| **200 useful NEW** | token counters/holders/transfers, addresses, smart-contracts, indexing-status, backend-version, main-page txs, internal-txs, address logs, coin-balance-history-by-day, NFT list |
| **200 empty/low value** | market chart (`chart_data: []`), token instances, withdrawals |
| **400 unavailable** | `/stats/charts/accounts`, `/proxy/adapters` |

### RPC (`rpc.testnet.arc.network`) — all OK
| Method | ms | Notes |
|--------|---:|-------|
| `eth_chainId` | ~900 | `0x4cef52` |
| `eth_blockNumber` | ~420 | |
| `eth_gasPrice` | ~390 | |
| `eth_getBlockByNumber` | ~420 | |
| `eth_getLogs` (1 block USDC) | ~530 | event indexing |
| `eth_call` (USDC totalSupply) | ~406 | |
| `web3_clientVersion` | ~400 | `reth/v1.11.3…` |

### What NEW data each unlocks for Arclytics

| Source | Sample live value | Project feature |
|--------|-------------------|-----------------|
| counters `totalAccounts` | ~2.90M | Fix address confusion; Accounts KPI |
| counters `txnsFee24h` | ~8,186 USDC | Real fees KPI (not DEX estimate) |
| counters `averageTxnFee24h` | ~0.0046 USDC | Network Overview |
| counters `newTxns24h` | ~1.78M | Better than chart latest alone |
| counters `totalUserOps` / AA wallets | ~2.6M / ~47K | Agents / AA page |
| `activeAccounts` line | day ~55K–254K | **True Active Addresses chart** |
| `txnsFee` line | daily fee USDC | Fees chart (replace Volume Proxy) |
| `newNativeCoinTransfers` | ~9K–25K/day | Native USDC activity chart |
| `txnsSuccessRate` | ~92–93% | Network health |
| `newUserOps` / AA charts | daily AA activity | Agents (ERC-8004) section |
| `/tokens/USDC/counters` | holders 4.12M, transfers 505M | Stablecoin KPIs (faster than full token) |
| `/tokens/USDC/holders` | ranked wallets + balances | Holders table |
| `/tokens/USDC/transfers` | live transfer feed | Stablecoin flow |
| `/addresses` | richest wallets | Whale / rankings |
| `/internal-transactions` | internal calls | Explorer depth |
| `/addresses/{cctp}/logs` | CCTP events | Bridge analytics |
| `/main-page/indexing-status` | fully indexed | Sidebar health |
| RPC `eth_getLogs` | USDC logs | Protocol volume history without ArcScan pages |
| RPC `eth_call` totalSupply | on-chain supply | Stablecoin mcap (supply × $1) |

### Recommended wire order after this test
1. `/counters` + `/pages/transactions` → dashboard KPIs (fees, accounts, txs 24h)  
2. Charts: `activeAccounts`, `txnsFee`, `newNativeCoinTransfers`  
3. Stablecoins: `/tokens/{addr}/counters` (+ holders/transfers tabs)  
4. Explorer: internal txs + indexing status  
5. Bridges: CCTP address logs / `eth_getLogs` on TokenMessengerV2  
