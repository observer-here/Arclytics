import type { ComponentType } from "react";
import { addresses } from "@arclytics/chain";
import { Icons } from "@/components/shared/Icons";

type IconProps = { size?: number; className?: string };

export type TokenFilterId =
  | "all"
  | "stablecoins"
  | "defi"
  | "rwa"
  | "other";

export type TokenCategory = "Stablecoin" | "DeFi" | "RWA" | "Other";

export const TOKEN_FILTERS: Array<{
  id: TokenFilterId;
  label: string;
  icon: ComponentType<IconProps>;
  match: TokenCategory[] | "all";
}> = [
  { id: "all", label: "All", icon: Icons.Grid, match: "all" },
  { id: "stablecoins", label: "Stablecoins", icon: Icons.Stablecoins, match: ["Stablecoin"] },
  { id: "defi", label: "DeFi", icon: Icons.DeFi, match: ["DeFi"] },
  { id: "rwa", label: "RWA", icon: Icons.Yield, match: ["RWA"] },
  { id: "other", label: "Other", icon: Icons.Layers, match: ["Other"] },
];

export const TOKEN_CATEGORY_PILL: Record<TokenCategory, string> = {
  Stablecoin: "bg-sky-50 text-sky-700 border-sky-100",
  DeFi: "bg-emerald-50 text-emerald-700 border-emerald-100",
  RWA: "bg-teal-50 text-teal-700 border-teal-100",
  Other: "bg-ink-50 text-ink-600 border-ink-100",
};

/**
 * Curated Arc Testnet tokens.
 * ArcScan has no exchange_rate / volume on testnet.
 * pegUsd: treat as $1 (USDC-native / USD vault share) until real oracle/LP pricing exists.
 */
export const LEGIT_TOKENS: Array<{
  address: `0x${string}`;
  category: TokenCategory;
  protocol?: string;
  pegUsd?: boolean;
}> = [
  { address: addresses.usdc, category: "Stablecoin", protocol: "Circle", pegUsd: true },
  { address: addresses.eurc, category: "Stablecoin", protocol: "Circle", pegUsd: true },
  { address: addresses.usyc, category: "RWA", protocol: "Circle", pegUsd: true },
  { address: addresses.cirBtc, category: "DeFi", protocol: "Circle" },
  { address: "0x911b4000D3422F482F4062a913885f7b035382Df", category: "Stablecoin", protocol: "WUSDC", pegUsd: true },
  { address: "0xde5db9049a8dd344dc1b7bbb098f9da60930a6da", category: "Stablecoin", protocol: "WUSDC", pegUsd: true },
  { address: "0x240Eb85458CD41361bd8C3773253a1D78054f747", category: "DeFi", protocol: "XyloNet", pegUsd: true },
  { address: "0x3DF3966F5138143dce7a9cFDdC2c0310ce083BB1", category: "DeFi", protocol: "XyloNet" },
  { address: "0xC5124C846c6e6307986988dFb7e743327aA05F19", category: "DeFi", protocol: "Synthra" },
  { address: "0xAC36804B4a860C5463F3B89d077a0653AaA9d8F1", category: "DeFi", protocol: "Synthra" },
  { address: "0x2D84D79C852f6842AbE0304b70bBaA1506AdD457", category: "DeFi", protocol: "Curve" },
  { address: "0xCd4e6C8056608e7CA5b8cD126F32c56c43D92979", category: "DeFi", protocol: "Curve" },
  { address: "0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf", category: "DeFi", protocol: "Arc LP" },
  { address: "0x97c0194480Adb526194835D2688A333BBE55d770", category: "DeFi", protocol: "Axpha" },
  { address: "0x142ec8437F645Baef1B3683f2065f53A26285A7a", category: "DeFi", protocol: "UnitFlow", pegUsd: true },
  { address: "0x66CF9CA9D75FD62438C6E254bA35E61775EF9496", category: "DeFi", protocol: "Lunex", pegUsd: true },
  { address: "0xcF2C839B12ECf6D9eEcd4607521B73fcFb7E8713", category: "DeFi", protocol: "Lunex", pegUsd: true },
  { address: "0x8eec82f219b4df75a1ba9083e6c1d43ea60173d3", category: "DeFi", protocol: "PerpDEX" },
  { address: "0xb3685D16AAa06361ED28377b1319136650Fa9A13", category: "DeFi", protocol: "ArcSwap" },
  { address: "0xc6b602bdb645b1c41a7fa78a3c942abc55b0c1b5", category: "DeFi", protocol: "WarpDex" },
  { address: "0xe5f41fa47cb6253750909fea73a3e4d049df921c", category: "DeFi", protocol: "ArcVault", pegUsd: true },
  { address: "0xFA61E1dE61DAf2EF4D8d9BAd4B99fa21C8EFAB8a", category: "DeFi", protocol: "ArcFlow" },
];

export function isPegUsd(address: string) {
  return LEGIT_TOKENS.some(
    (t) => t.pegUsd && t.address.toLowerCase() === address.toLowerCase(),
  );
}
