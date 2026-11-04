import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "apps", "web", "public", "tokens");
mkdirSync(outDir, { recursive: true });

const tokens = [
  { address: "0x3600000000000000000000000000000000000000", protocol: "Circle" },
  { address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a", protocol: "Circle" },
  { address: "0x911b4000D3422F482F4062a913885f7b035382Df", protocol: "WUSDC" },
  { address: "0x175cdb1d338945f0d851a741ccf787d343e57952", protocol: "Tether" },
  { address: "0x825ae482558415310c71b7e03d2bbbe409345903", protocol: "Circle" },
  { address: "0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C", protocol: "Circle" },
  { address: "0xde5db9049a8dd344dc1b7bbb098f9da60930a6da", protocol: "WUSDC" },
  { address: "0x3DF3966F5138143dce7a9cFDdC2c0310ce083BB1", protocol: "XyloNet" },
  { address: "0x240Eb85458CD41361bd8C3773253a1D78054f747", protocol: "XyloNet" },
  { address: "0x2D84D79C852f6842AbE0304b70bBaA1506AdD457", protocol: "Curve" },
  { address: "0x0714027e44802b2ff76389daf5371990cc3a4c24", protocol: "Curve" },
  { address: "0xCd4e6C8056608e7CA5b8cD126F32c56c43D92979", protocol: "Curve" },
  { address: "0x3a5964ce5cd8b09e55af9323a894e78bdd7f04bf", protocol: "Arc LP" },
  { address: "0xb3685D16AAa06361ED28377b1319136650Fa9A13", protocol: "ArcSwap" },
  { address: "0xc6b602bdb645b1c41a7fa78a3c942abc55b0c1b5", protocol: "WarpDex" },
  { address: "0xd065a783C362d73b5a62EfB2B2e5DEDe49d16aa3", protocol: "DeFi on ARC" },
  { address: "0xFabB12B18c4b0B79dd97D8EA7c000F7424C76195", protocol: "DeFi on ARC" },
  { address: "0xa7Eb57a1538BC8ca2F0452954610A7d6f1F0242B", protocol: "DeFi on ARC" },
  { address: "0x55b9CbF50dc1171526635d03267f4A0979f1fFBb", protocol: "DeFi on ARC" },
  { address: "0xFDC1F922f7065602F06504d62E314A1cEe72c189", protocol: "DeFi on ARC" },
  { address: "0xAC36804B4a860C5463F3B89d077a0653AaA9d8F1", protocol: "Synthra" },
  { address: "0x97c0194480Adb526194835D2688A333BBE55d770", protocol: "Axpha" },
  { address: "0xe181e495d364558a53774b06be135e1a283a42a7", protocol: "PerpDEX" },
  { address: "0x8eec82f219b4df75a1ba9083e6c1d43ea60173d3", protocol: "PerpDEX" },
  { address: "0x66CF9CA9D75FD62438C6E254bA35E61775EF9496", protocol: "Lunex" },
  { address: "0xcF2C839B12ECf6D9eEcd4607521B73fcFb7E8713", protocol: "Lunex" },
  { address: "0xe5f41fa47cb6253750909fea73a3e4d049df921c", protocol: "ArcVault" },
  { address: "0x142ec8437F645Baef1B3683f2065f53A26285A7a", protocol: "UnitFlow" },
  { address: "0xc0d12a7cf565a004757c62caf34dd37467f57f0e", protocol: "Axpha" },
  { address: "0x3554d4d10682fdc680a2cb64ada35f8e7a297a32", protocol: "Arc Dollar" },
  { address: "0xed7cb772b49448027901546870425579596faae1", protocol: "Arc Dollar" },
  { address: "0xC5124C846c6e6307986988dFb7e743327aA05F19", protocol: "Synthra" },
  { address: "0xbe7477bf91526fc9988c8f33e91b6db687119d45", protocol: "Swaparc" },
  { address: "0x49cd69442db073e7b94b0124e316ab7c68b95988", protocol: "DeFi on ARC" },
  { address: "0x63f856fbab3535174bfafd6efd720c634d6fd458", protocol: "DeFi on ARC" },
  { address: "0x6e63e2cabecce5c3a1c37b79a958a9542076a1e3", protocol: "DeFi on ARC" },
  { address: "0x832fa4331050045f911bd6d59ead144a04b965cb", protocol: "DeFi on ARC" },
  { address: "0xe470a3fb08345fd4a84c1b56bd35ba7be6297c3d", protocol: "DeFi on ARC" },
  { address: "0xc3328be246c5db1a2eba7d0533e275a0a7249834", protocol: "Community" },
  { address: "0x8959ed0d7220e1baa445106f48829df0bf1e5f83", protocol: "Community" },
  { address: "0x48ff1ccb0f75e5a8c732b6c10ffc8f5df6ef5311", protocol: "Community" },
  { address: "0x6b64b4be058d33fc37f45a92ff7a45da41dbf12b", protocol: "Community" },
  { address: "0x02a0545e0f6dce7e0fb68bc4ed0e9688e29e6ee1", protocol: "Community" },
  { address: "0x808e4e5a6006296b274c02683d17047bea92e6ba", protocol: "Community" },
  { address: "0xfa61e1de61daf2ef4d8d9bad4b99fa21c8efab8a", protocol: "ArcFlow" },
  { address: "0x7d94bb687216f36df9deac7b340e470f06473b25", protocol: "wARC" },
  { address: "0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF", protocol: "Circle" },
];

const protocolFallback = {
  Circle: "https://icons.llama.fi/circle.png",
  Tether: "https://icons.llama.fi/tether.png",
  WUSDC: "https://www.xylonet.xyz/tokens/usdc.png",
  XyloNet: "https://www.xylonet.xyz/branding/3d-icon.png",
  Curve: "https://icons.llama.fi/curve.png",
  Synthra: "https://docs.synthra.org/synthra-mark-cropped.png",
  Axpha: "https://unavatar.io/twitter/axpha_io",
  Lunex: "https://lunexonarc.vercel.app/lunex-logo.png",
  "DeFi on ARC": "https://defi-on-arc.org/favicon.ico",
  WarpDex: "https://unavatar.io/twitter/warpdex",
  ArcSwap: "https://raw.githubusercontent.com/osr21/arc-swap/main/artifacts/arc-swap/public/favicon.svg",
  Swaparc: "https://raw.githubusercontent.com/osr21/arc-swap/main/artifacts/arc-swap/public/favicon.svg",
  UnitFlow: "https://app.unitflow.finance/logo.jpg",
  PerpDEX: "https://app.synthra.org/images/favicon-96x96.png",
  "Arc LP": "https://www.xylonet.xyz/chains/arc.png",
  "Arc Dollar": "https://www.xylonet.xyz/chains/arc.png",
  ArcVault: "https://www.xylonet.xyz/chains/arc.png",
  ArcFlow: "https://www.arcflow.live/favicon.ico",
  wARC: "https://www.xylonet.xyz/chains/arc.png",
  Community: null,
};

const symbolSvg = (sym, bg, fg = "#fff") => {
  const fs = sym.length > 2 ? 16 : 26;
  const y = sym.length > 2 ? 38 : 42;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="32" fill="${bg}"/><text x="32" y="${y}" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="700" font-size="${fs}" fill="${fg}">${sym}</text></svg>`;
};

const communitySvg = {
  "0xc3328be246c5db1a2eba7d0533e275a0a7249834": symbolSvg("CAT", "#f97316"),
  "0x8959ed0d7220e1baa445106f48829df0bf1e5f83": symbolSvg("DARC", "#6366f1"),
  "0x48ff1ccb0f75e5a8c732b6c10ffc8f5df6ef5311": symbolSvg("PANDA", "#111827", "#f9fafb"),
  "0x6b64b4be058d33fc37f45a92ff7a45da41dbf12b": symbolSvg("MOON", "#312e81", "#fde047"),
  "0x02a0545e0f6dce7e0fb68bc4ed0e9688e29e6ee1": symbolSvg("SUN", "#f59e0b"),
  "0x808e4e5a6006296b274c02683d17047bea92e6ba": symbolSvg("AD", "#dc2626"),
  "0xfa61e1de61daf2ef4d8d9bad4b99fa21c8efab8a": symbolSvg("AF", "#0ea5e9"),
};

const usdc = "https://www.xylonet.xyz/tokens/usdc.png";
const eurc = "https://www.xylonet.xyz/tokens/eurc.png";

const map = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url, dest) {
  const r = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(45_000) });
  if (!r.ok) throw new Error(`${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 80) throw new Error("too small");
  writeFileSync(dest, buf);
  return buf.length;
}

for (const t of tokens) {
  const key = t.address.toLowerCase();
  const fileBase = key.slice(2);
  let url = null;
  let symbol = "";

  try {
    const j = await fetch(`https://explorer.testnet.arc.io/api/v2/tokens/${t.address}`).then((r) => r.json());
    if (j.icon_url) url = String(j.icon_url);
    symbol = String(j.symbol ?? "");
  } catch {
    // skip
  }

  if (!url) {
    if (key === "0x3600000000000000000000000000000000000000") url = usdc;
    else if (key === "0x89b50855aa3be2f677cd6303cec089b5f319d72a") url = eurc;
    else url = protocolFallback[t.protocol] ?? null;
  }

  if (!url && communitySvg[key]) {
    const dest = join(outDir, `${fileBase}.svg`);
    writeFileSync(dest, communitySvg[key]);
    map[key] = `/tokens/${fileBase}.svg`;
    console.log("svg", symbol || fileBase.slice(0, 8), map[key]);
    await sleep(50);
    continue;
  }

  if (!url) {
    console.log("skip", symbol || fileBase.slice(0, 8), t.protocol);
    continue;
  }

  const ext = url.includes(".svg") ? ".svg" : url.includes(".ico") ? ".ico" : url.includes(".jpg") ? ".jpg" : ".png";
  const dest = join(outDir, `${fileBase}${ext}`);
  try {
    const n = await download(url, dest);
    map[key] = `/tokens/${fileBase}${ext}`;
    console.log("ok", symbol || fileBase.slice(0, 8), map[key], n);
  } catch (e) {
    console.log("fail", symbol || fileBase.slice(0, 8), e.message);
  }
  await sleep(100);
}

const logosTs = `// Auto-generated by scripts/fetch-token-logos.mjs\nexport const TOKEN_LOGOS: Record<string, string> = ${JSON.stringify(map, null, 2)};\n\nexport function tokenLogo(address: string): string | undefined {\n  return TOKEN_LOGOS[address.toLowerCase()];\n}\n`;
writeFileSync(join(root, "packages", "chain", "src", "logos.ts"), logosTs);
console.log("mapped", Object.keys(map).length);
