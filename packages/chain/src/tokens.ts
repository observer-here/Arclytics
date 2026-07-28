import { addresses } from "./addresses";

export type TokenCategory =
  | "Stablecoin"
  | "DeFi"
  | "Community"
  | "RWA"
  | "Other";

export type AmmKind =
  | "stablecoin"
  | "curve-stableswap"
  | "uniswap-v2"
  | "stable-amm"
  | "vault-share"
  | "perp-lp"
  | "lending-share"
  | "wrapper"
  | "spot";

export type CuratedToken = {
  address: `0x${string}`;
  category: TokenCategory;
  protocol: string;
  amm: AmmKind;
  pegUsd?: boolean;
  fromReserves?: boolean;
  spotPool?: `0x${string}`;
  blurb?: string;
};

export const RESERVE_USD: Record<string, number> = {
  [addresses.usdc.toLowerCase()]: 1,
  [addresses.eurc.toLowerCase()]: 1.08,
  [addresses.usyc.toLowerCase()]: 1,
  "0x825ae482558415310c71b7e03d2bbbe409345903": 1,
  "0x175cdb1d338945f0d851a741ccf787d343e57952": 1,
};

/** Curated Arc Testnet tokens — shared by API ingest + web UI. */
export const CURATED_TOKENS: CuratedToken[] = [
  { address: addresses.usdc, category: "Stablecoin", protocol: "Circle", amm: "stablecoin", pegUsd: true, blurb: "#1 on ArcScan — ~4.1M holders, ~506M transfers" },
  { address: addresses.eurc, category: "Stablecoin", protocol: "Circle", amm: "stablecoin", pegUsd: true, blurb: "#2 interest — ~1.5M holders, ~130M transfers" },
  { address: "0x911b4000D3422F482F4062a913885f7b035382Df", category: "Stablecoin", protocol: "WUSDC", amm: "wrapper", pegUsd: true, blurb: "Wrapped USDC — ~644k holders, ~140M transfers" },
  { address: "0x175cdb1d338945f0d851a741ccf787d343e57952", category: "Stablecoin", protocol: "Tether", amm: "stablecoin", pegUsd: true, blurb: "USDT on Arc — ~299k holders, ~6M transfers" },
  { address: "0x825ae482558415310c71b7e03d2bbbe409345903", category: "RWA", protocol: "Circle", amm: "stablecoin", pegUsd: true, blurb: "Most-held USYC on ArcScan (~42k holders)" },
  { address: addresses.usyc, category: "RWA", protocol: "Circle", amm: "stablecoin", pegUsd: true, blurb: "Canonical USYC address in Arc registry" },
  { address: "0xde5db9049a8dd344dc1b7bbb098f9da60930a6da", category: "Stablecoin", protocol: "WUSDC", amm: "wrapper", pegUsd: true },

  { address: "0x3DF3966F5138143dce7a9cFDdC2c0310ce083BB1", category: "DeFi", protocol: "XyloNet", amm: "stable-amm", fromReserves: true, blurb: "Top LP by holders (~604k)" },
  { address: "0x240Eb85458CD41361bd8C3773253a1D78054f747", category: "DeFi", protocol: "XyloNet", amm: "vault-share", pegUsd: true, blurb: "xyUSDC vault — ~285k holders" },
  { address: "0x2D84D79C852f6842AbE0304b70bBaA1506AdD457", category: "DeFi", protocol: "Curve", amm: "curve-stableswap", fromReserves: true },
  { address: "0x0714027e44802b2ff76389daf5371990cc3a4c24", category: "DeFi", protocol: "Curve", amm: "curve-stableswap", fromReserves: true },
  { address: "0xCd4e6C8056608e7CA5b8cD126F32c56c43D92979", category: "DeFi", protocol: "Curve", amm: "curve-stableswap", fromReserves: true, blurb: "USDCEURC gauge deposit" },
  { address: "0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf", category: "DeFi", protocol: "Arc LP", amm: "stable-amm", fromReserves: true },
  { address: "0xb3685D16AAa06361ED28377b1319136650Fa9A13", category: "DeFi", protocol: "ArcSwap", amm: "uniswap-v2", fromReserves: true },
  { address: "0xc6b602bdb645b1c41a7fa78a3c942abc55b0c1b5", category: "DeFi", protocol: "WarpDex", amm: "uniswap-v2", fromReserves: true },
  { address: "0xd065a783C362d73b5a62EfB2B2e5DEDe49d16aa3", category: "DeFi", protocol: "DeFi on ARC", amm: "uniswap-v2", fromReserves: true, blurb: "SRAC/USDC pool LP" },
  { address: "0xFabB12B18c4b0B79dd97D8EA7c000F7424C76195", category: "DeFi", protocol: "DeFi on ARC", amm: "uniswap-v2", fromReserves: true },
  { address: "0xa7Eb57a1538BC8ca2F0452954610A7d6f1F0242B", category: "DeFi", protocol: "DeFi on ARC", amm: "uniswap-v2", fromReserves: true },
  { address: "0x55b9CbF50dc1171526635d03267f4A0979f1fFBb", category: "DeFi", protocol: "DeFi on ARC", amm: "uniswap-v2", fromReserves: true },
  { address: "0xFDC1F922f7065602F06504d62E314A1cEe72c189", category: "DeFi", protocol: "DeFi on ARC", amm: "uniswap-v2", fromReserves: true },
  { address: "0xAC36804B4a860C5463F3B89d077a0653AaA9d8F1", category: "DeFi", protocol: "Synthra", amm: "perp-lp", fromReserves: true },
  { address: "0x97c0194480Adb526194835D2688A333BBE55d770", category: "DeFi", protocol: "Axpha", amm: "perp-lp", fromReserves: true },
  { address: "0xe181e495d364558a53774b06be135e1a283a42a7", category: "DeFi", protocol: "PerpDEX", amm: "perp-lp", fromReserves: true },
  { address: "0x8eec82f219b4df75a1ba9083e6c1d43ea60173d3", category: "DeFi", protocol: "PerpDEX", amm: "perp-lp", fromReserves: true },
  { address: "0x66CF9CA9D75FD62438C6E254bA35E61775EF9496", category: "DeFi", protocol: "Lunex", amm: "vault-share", fromReserves: true, pegUsd: true },
  { address: "0xcF2C839B12ECf6D9eEcd4607521B73fcFb7E8713", category: "DeFi", protocol: "Lunex", amm: "vault-share", fromReserves: true, pegUsd: true },
  { address: "0xe5f41fa47cb6253750909fea73a3e4d049df921c", category: "DeFi", protocol: "ArcVault", amm: "vault-share", pegUsd: true },
  { address: "0x142ec8437F645Baef1B3683f2065f53A26285A7a", category: "DeFi", protocol: "UnitFlow", amm: "lending-share", pegUsd: true, blurb: "uUSDC — ~48k holders" },
  { address: "0xc0d12a7cf565a004757c62caf34dd37467f57f0e", category: "DeFi", protocol: "Axpha", amm: "lending-share", pegUsd: true, blurb: "USDC.a receipt token" },
  { address: "0x3554d4d10682fdc680a2cb64ada35f8e7a297a32", category: "DeFi", protocol: "Arc Dollar", amm: "vault-share", fromReserves: true, pegUsd: true, blurb: "astUSDC staked Arc Dollar" },
  { address: "0xed7cb772b49448027901546870425579596faae1", category: "Stablecoin", protocol: "Arc Dollar", amm: "stablecoin", pegUsd: true },

  { address: "0xC5124C846c6e6307986988dFb7e743327aA05F19", category: "Community", protocol: "Synthra", amm: "wrapper", blurb: "SYN — ~123k holders, ~4.5M transfers" },
  { address: "0xbe7477bf91526fc9988c8f33e91b6db687119d45", category: "Community", protocol: "Swaparc", amm: "spot", blurb: "SWPRC — ~115k holders, ~6.5M transfers" },
  { address: "0x49cd69442db073e7b94b0124e316ab7c68b95988", category: "Community", protocol: "DeFi on ARC", amm: "spot", spotPool: "0xd065a783C362d73b5a62EfB2B2e5DEDe49d16aa3", blurb: "SRAC — top community token by activity" },
  { address: "0x63f856fbab3535174bfafd6efd720c634d6fd458", category: "Community", protocol: "DeFi on ARC", amm: "spot", spotPool: "0xFDC1F922f7065602F06504d62E314A1cEe72c189" },
  { address: "0x6e63e2cabecce5c3a1c37b79a958a9542076a1e3", category: "Community", protocol: "DeFi on ARC", amm: "spot", spotPool: "0x55b9CbF50dc1171526635d03267f4A0979f1fFBb" },
  { address: "0x832fa4331050045f911bd6d59ead144a04b965cb", category: "Community", protocol: "DeFi on ARC", amm: "spot", spotPool: "0xa7Eb57a1538BC8ca2F0452954610A7d6f1F0242B" },
  { address: "0xe470a3fb08345fd4a84c1b56bd35ba7be6297c3d", category: "Community", protocol: "DeFi on ARC", amm: "spot", spotPool: "0xFabB12B18c4b0B79dd97D8EA7c000F7424C76195" },
  { address: "0xc3328be246c5db1a2eba7d0533e275a0a7249834", category: "Community", protocol: "Community", amm: "spot", blurb: "CAT — ~63k holders, ~2M transfers" },
  { address: "0x8959ed0d7220e1baa445106f48829df0bf1e5f83", category: "Community", protocol: "Community", amm: "spot" },
  { address: "0x48ff1ccb0f75e5a8c732b6c10ffc8f5df6ef5311", category: "Community", protocol: "Community", amm: "spot" },
  { address: "0x6b64b4be058d33fc37f45a92ff7a45da41dbf12b", category: "Community", protocol: "Community", amm: "spot", blurb: "MOON — ~105k holders" },
  { address: "0x02a0545e0f6dce7e0fb68bc4ed0e9688e29e6ee1", category: "Community", protocol: "Community", amm: "spot", blurb: "SUN — ~100k holders" },
  { address: "0x808e4e5a6006296b274c02683d17047bea92e6ba", category: "Community", protocol: "Community", amm: "spot" },
  { address: "0xfa61e1de61daf2ef4d8d9bad4b99fa21c8efab8a", category: "DeFi", protocol: "ArcFlow", amm: "wrapper", blurb: "AFF-V25 — ~53k holders" },
  { address: "0x7d94bb687216f36df9deac7b340e470f06473b25", category: "Other", protocol: "wARC", amm: "wrapper" },
  { address: addresses.cirBtc, category: "DeFi", protocol: "Circle", amm: "wrapper", blurb: "cirBTC — ~57k holders" },
];

export function curatedTokenMeta(address: string): CuratedToken | undefined {
  const a = address.toLowerCase();
  return CURATED_TOKENS.find((t) => t.address.toLowerCase() === a);
}
