import type { ComponentType } from "react";
import { Icons } from "@/components/shared/Icons";

type IconProps = { size?: number; className?: string };

export type EcosystemFilterId =
  | "all"
  | "defi"
  | "dex"
  | "perps"
  | "lending"
  | "yield"
  | "derivatives"
  | "options"
  | "insurance"
  | "predict"
  | "gaming"
  | "nft"
  | "social"
  | "payments"
  | "infra"
  | "other";

export const ECOSYSTEM_FILTERS: Array<{
  id: EcosystemFilterId;
  label: string;
  icon: ComponentType<IconProps>;
  match: string[];
}> = [
  { id: "all", label: "All", icon: Icons.Grid, match: [] },
  { id: "defi", label: "DeFi", icon: Icons.DeFi, match: ["dex", "lending", "yield", "derivatives", "stablecoin"] },
  { id: "dex", label: "DEX", icon: Icons.Dex, match: ["dex"] },
  { id: "perps", label: "Perps", icon: Icons.Perps, match: ["derivatives"] },
  { id: "lending", label: "Lending", icon: Icons.Lending, match: ["lending"] },
  { id: "yield", label: "Yield", icon: Icons.Yield, match: ["yield"] },
  { id: "derivatives", label: "Derivatives", icon: Icons.Activity, match: ["derivatives"] },
  { id: "options", label: "Options", icon: Icons.Options, match: ["options"] },
  { id: "insurance", label: "Insurance", icon: Icons.Insurance, match: ["insurance"] },
  { id: "predict", label: "Predict Market", icon: Icons.Predict, match: ["predict"] },
  { id: "gaming", label: "Gaming", icon: Icons.Gaming, match: ["gaming"] },
  { id: "nft", label: "NFT", icon: Icons.Nfts, match: ["nft"] },
  { id: "social", label: "Social", icon: Icons.Social, match: ["social"] },
  { id: "payments", label: "Payments", icon: Icons.Wallet, match: ["payments"] },
  { id: "infra", label: "Infra", icon: Icons.Infra, match: ["infrastructure", "bridge"] },
  { id: "other", label: "Other", icon: Icons.Layers, match: ["other", "rwa", "stablecoin"] },
];

export const CATEGORY_PILL: Record<string, string> = {
  dex: "bg-emerald-50 text-emerald-700",
  lending: "bg-sky-50 text-sky-700",
  yield: "bg-amber-50 text-amber-700",
  bridge: "bg-indigo-50 text-indigo-700",
  derivatives: "bg-violet-50 text-violet-700",
  stablecoin: "bg-teal-50 text-teal-700",
  rwa: "bg-orange-50 text-orange-700",
  payments: "bg-blue-50 text-blue-700",
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
  payments: "#2563eb",
  other: "#64748b",
};
