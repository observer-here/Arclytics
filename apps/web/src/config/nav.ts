import { paths } from "@/routes/paths";

export const mainNav = [
  { href: paths.home, label: "Dashboard", icon: "Dashboard" as const },
  { href: paths.ecosystem, label: "Ecosystem", icon: "Ecosystem" as const },
  { href: paths.tokens, label: "Tokens", icon: "Tokens" as const },
  { href: paths.nfts, label: "NFTs", icon: "Nfts" as const },
];

export const toolsNav = [
  { href: paths.ask, label: "Ask Arclytics", icon: "Ask" as const },
  { href: paths.analytics, label: "Analytics", icon: "Analytics" as const },
  { href: paths.explorer, label: "Explorer", icon: "Explorer" as const },
  { href: paths.walletTracker, label: "Wallet Tracker", icon: "Wallet" as const },
  { href: paths.compare, label: "Compare", icon: "Compare" as const },
  { href: paths.watchlist, label: "Watchlist", icon: "Watchlist" as const },
  { href: paths.settings, label: "Settings", icon: "Settings" as const },
];
