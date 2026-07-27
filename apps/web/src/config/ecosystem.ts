import type { ComponentType } from "react";
import { Icons } from "@/components/shared/Icons";

type IconProps = { size?: number; className?: string };

export type EcosystemFilterId =
  | "all"
  | "defi"
  | "dex"
  | "derivatives"
  | "lending"
  | "yield"
  | "liquid_staking"
  | "restaking"
  | "rwa"
  | "stablecoin"
  | "bridge"
  | "oracle"
  | "infrastructure"
  | "nft";

export const ECOSYSTEM_FILTERS: Array<{
  id: EcosystemFilterId;
  label: string;
  icon: ComponentType<IconProps>;
  match: string[];
}> = [
  { id: "all", label: "All", icon: Icons.Grid, match: [] },
  { id: "defi", label: "DeFi", icon: Icons.DeFi, match: ["dex", "lending", "yield", "derivatives", "stablecoin"] },
  { id: "dex", label: "DEX", icon: Icons.Dex, match: ["dex"] },
  { id: "derivatives", label: "Perps", icon: Icons.Perps, match: ["derivatives"] },
  { id: "lending", label: "Lending", icon: Icons.Lending, match: ["lending"] },
  { id: "yield", label: "Yield", icon: Icons.Yield, match: ["yield"] },
  { id: "liquid_staking", label: "Liquid Staking", icon: Icons.LiquidStaking, match: ["liquid_staking"] },
  { id: "restaking", label: "Restaking", icon: Icons.Restaking, match: ["restaking"] },
  { id: "rwa", label: "RWA", icon: Icons.Rwa, match: ["rwa"] },
  { id: "stablecoin", label: "Stablecoins", icon: Icons.Stablecoins, match: ["stablecoin"] },
  { id: "bridge", label: "Bridges", icon: Icons.Bridges, match: ["bridge"] },
  { id: "oracle", label: "Oracles", icon: Icons.Oracle, match: ["oracle"] },
  { id: "infrastructure", label: "Infrastructure", icon: Icons.Infra, match: ["infrastructure", "other"] },
  { id: "nft", label: "NFT Marketplace", icon: Icons.Nfts, match: ["nft"] },
];

export const CATEGORY_PILL: Record<string, string> = {
  dex: "bg-emerald-50 text-emerald-700",
  lending: "bg-sky-50 text-sky-700",
  yield: "bg-amber-50 text-amber-700",
  bridge: "bg-indigo-50 text-indigo-700",
  derivatives: "bg-violet-50 text-violet-700",
  stablecoin: "bg-teal-50 text-teal-700",
  rwa: "bg-orange-50 text-orange-700",
  other: "bg-ink-100 text-ink-600",
};

export const CATEGORY_ACCENT: Record<string, string> = {
  dex: "#10b981",
  lending: "#0ea5e9",
  yield: "#f59e0b",
  bridge: "#6366f1",
  derivatives: "#8b5cf6",
  stablecoin: "#14b8a6",
  rwa: "#f97316",
  other: "#64748b",
};
