export const details = {
  builder: "chriswilder.eth (@realchriswilder)",
  status: "testnet" as const,
  featured: true,
  categoryLabel: "DEX",
  summary:
    "Community DEX with USDC liquidity pools (SRAC, KITTY, DOGG, RACS, SACS). Live at defi-on-arc.org.",
  links: {
    website: "https://defi-on-arc.org",
    app: "https://defi-on-arc.netlify.app",
    twitter: "https://x.com/realchriswilder",
    post: "https://x.com/i/status/1988500386089513265",
  },
  contracts: {
    factory: "0x34A0b64a88BBd4Bf6Acba8a0Ff8F27c8aDD67E9C",
    router: "0x284C5Afc100ad14a458255075324fA0A9dfd66b1",
    staking: "0x814b2b51c0A2d1Ba932A2D16e73de1C3cABc3BC1",
    pools: {
      sracUsdc: "0xd065a783C362d73b5a62EfB2B2e5DEDe49d16aa3",
      kittyUsdc: "0xFabB12B18c4b0B79dd97D8EA7c000F7424C76195",
      doggUsdc: "0xa7Eb57a1538BC8ca2F0452954610A7d6f1F0242B",
      racsUsdc: "0x55b9CbF50dc1171526635d03267f4A0979f1fFBb",
      sacsUsdc: "0xFDC1F922f7065602F06504d62E314A1cEe72c189",
    },
  },
  sources: ["defi-on-arc.org", "X/@realchriswilder", "ArcScan"],
};
