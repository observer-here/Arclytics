export const details = {
  builder: "Community (linoxbt)",
  status: "testnet" as const,
  featured: true,
  categoryLabel: "Yield / StableSwap",
  summary:
    "ArcLens Established. Stablecoin DEX + ERC-4626 vaults optimized for USDC/EURC.",
  links: {
    website: "https://lunexonarc.vercel.app",
    github: "https://github.com/linoxbt/Lunex-on-Arc",
    dorahacks: "https://dorahacks.io/buidl/41404",
  },
  contracts: {
    stableSwapPool: "0xC24BFc8e4b10500a72A63Bec98CCC989CbDA41d8",
    lpToken: "0x9fD18A3dCbcb8238f7426E888bA73aFfbF9F3b69",
    vaultUsdc: "0x66CF9CA9D75FD62438C6E254bA35E61775EF9496",
    vaultEurc: "0xcF2C839B12ECf6D9eEcd4607521B73fcFb7E8713",
  },
  sources: ["Lunex deploy config", "ArcLens", "ArcScan"],
};
