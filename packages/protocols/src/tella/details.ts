export const details = {
  builder: "TELLA CORE LTD",
  status: "testnet" as const,
  featured: true,
  categoryLabel: "Messaging Payments",
  summary:
    "WhatsApp-native USDC interface on Arc. Circle Developer-Controlled Wallets (EOA) per user; no published vault/router. Local cash-out path starts with USDC → NGN in Nigeria.",
  links: {
    website: "https://www.tella.cash/",
    whatsapp: "https://wa.me/2349043580863?text=Hi%20tella",
    linkedin: "https://www.linkedin.com/company/tellacash",
    github: "https://github.com/tella-cash/tella-cash",
  },
  contracts: {} as Record<string, string>,
  sources: [
    "tella.cash",
    "github.com/tella-cash/tella-cash",
    "Circle Developer-Controlled Wallets",
    "ArcScan (no named Tella contracts)",
  ],
};
