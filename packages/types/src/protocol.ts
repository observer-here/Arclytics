export type ProtocolCategory =
  | "dex"
  | "lending"
  | "yield"
  | "bridge"
  | "rwa"
  | "stablecoin"
  | "derivatives"
  | "payments"
  | "other";

export type ContractRole =
  | "factory"
  | "router"
  | "pool"
  | "vault"
  | "lending_pool"
  | "gauge"
  | "token"
  | "bridge"
  | "other";

export interface ProtocolContract {
  address: `0x${string}`;
  role: ContractRole;
  label?: string;
}

export interface ProtocolConfig {
  slug: string;
  name: string;
  category: ProtocolCategory;
  description?: string;
  website?: string;
  docs?: string;
  twitter?: string;
  discord?: string;
  /** Protocol fee in basis points applied to 24h volume (e.g. 30 = 0.30%). */
  feeBps?: number;
  contracts: ProtocolContract[];
  tvlTokens: `0x${string}`[];
}
