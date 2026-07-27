export type ProtocolCategory =
  | "dex"
  | "lending"
  | "yield"
  | "bridge"
  | "rwa"
  | "stablecoin"
  | "derivatives"
  | "other";

export type ContractRole =
  | "factory"
  | "router"
  | "pool"
  | "vault"
  | "lending_pool"
  | "gauge"
  | "token"
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
  contracts: ProtocolContract[];
  tvlTokens: `0x${string}`[];
}
