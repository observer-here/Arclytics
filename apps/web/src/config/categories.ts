export const PROTOCOL_CATEGORIES = [
  "all",
  "dex",
  "lending",
  "yield",
  "bridge",
  "rwa",
  "stablecoin",
  "derivatives",
  "payments",
  "other",
] as const;

export type ProtocolCategoryFilter = (typeof PROTOCOL_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProtocolCategoryFilter, string> = {
  all: "All",
  dex: "DEX",
  lending: "Lending",
  yield: "Yield",
  bridge: "Bridges",
  rwa: "RWA",
  stablecoin: "Stablecoins",
  derivatives: "Derivatives",
  payments: "Payments",
  other: "Other",
};
