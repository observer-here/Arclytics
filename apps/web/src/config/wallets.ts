export type WalletLabel =
  | "Smart Money"
  | "Whale"
  | "Top Trader"
  | "NFT Collector"
  | "New Wallet"
  | "DeFi User";

export type WalletFilter =
  | "all"
  | "smart"
  | "traders"
  | "whales"
  | "new"
  | "watchlist";

export const WALLET_FILTERS: Array<{ id: WalletFilter; label: string }> = [
  { id: "all", label: "All Wallets" },
  { id: "smart", label: "Smart Money" },
  { id: "traders", label: "Top Traders" },
  { id: "whales", label: "Whales" },
  { id: "new", label: "New Wallets" },
  { id: "watchlist", label: "Watchlist" },
];

export const WALLET_LABEL_PILL: Record<WalletLabel, string> = {
  "Smart Money": "bg-violet-100 text-violet-700",
  Whale: "bg-sky-100 text-sky-700",
  "Top Trader": "bg-amber-100 text-amber-700",
  "NFT Collector": "bg-indigo-100 text-indigo-700",
  "New Wallet": "bg-emerald-100 text-emerald-700",
  "DeFi User": "bg-ink-100 text-ink-600",
};

export const ADDR_RE = /^0x[a-fA-F0-9]{40}$/;

export const TRACKED_KEY = "arclytics:tracked-wallets";
export const WATCHLIST_KEY = "arclytics:wallet-watchlist";
