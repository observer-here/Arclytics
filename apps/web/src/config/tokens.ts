import type { ComponentType } from "react";
import {
  CURATED_TOKENS,
  curatedTokenMeta,
  type AmmKind,
  type CuratedToken,
  type TokenCategory,
} from "@arclytics/chain";
import { Icons } from "@/components/shared/Icons";

export type { AmmKind, TokenCategory };
export type LegitToken = CuratedToken;
export { CURATED_TOKENS as LEGIT_TOKENS, curatedTokenMeta as tokenMeta };

type IconProps = { size?: number; className?: string };

export type TokenFilterId =
  | "all"
  | "stablecoins"
  | "defi"
  | "community"
  | "rwa"
  | "other";

export const AMM_LABEL: Record<AmmKind, string> = {
  stablecoin: "Peg",
  "curve-stableswap": "Curve StableSwap",
  "uniswap-v2": "Uniswap V2",
  "stable-amm": "Stable AMM",
  "vault-share": "ERC-4626 Vault",
  "perp-lp": "Perp LP",
  "lending-share": "Lending Share",
  wrapper: "Wrapper",
  spot: "Spot (USDC pool)",
};

export const TOKEN_FILTERS: Array<{
  id: TokenFilterId;
  label: string;
  icon: ComponentType<IconProps>;
  match: TokenCategory[] | "all";
}> = [
  { id: "all", label: "All", icon: Icons.Grid, match: "all" },
  { id: "stablecoins", label: "Stablecoins", icon: Icons.Stablecoins, match: ["Stablecoin"] },
  { id: "defi", label: "DeFi", icon: Icons.DeFi, match: ["DeFi"] },
  { id: "community", label: "Community", icon: Icons.Users, match: ["Community"] },
  { id: "rwa", label: "RWA", icon: Icons.Yield, match: ["RWA"] },
  { id: "other", label: "Other", icon: Icons.Layers, match: ["Other"] },
];

export const TOKEN_CATEGORY_PILL: Record<TokenCategory, string> = {
  Stablecoin: "bg-sky-50 text-sky-700 border-sky-100",
  DeFi: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Community: "bg-amber-50 text-amber-700 border-amber-100",
  RWA: "bg-teal-50 text-teal-700 border-teal-100",
  Other: "bg-ink-50 text-ink-600 border-ink-100",
};
