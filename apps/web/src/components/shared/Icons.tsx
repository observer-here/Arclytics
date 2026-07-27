import type { ReactNode } from "react";

type IconProps = { size?: number; className?: string };

function Svg({
  size = 16,
  className,
  children,
}: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export const Icons = {
  Dashboard: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V20h14V9.5" />
      <path d="M9 20v-6h6v6" />
    </Svg>
  ),
  Ecosystem: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 010 18 14 14 0 010-18z" />
    </Svg>
  ),
  DeFi: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 21h18" />
      <path d="M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-7h6v7" />
      <path d="M9 12h.01M15 12h.01" />
    </Svg>
  ),
  Tokens: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10" />
      <path d="M9.5 9.5c.7-1 1.8-1.5 2.5-1.5 1.4 0 2.5.8 2.5 2s-1 1.8-2.5 2.2S9.5 13.2 9.5 14.7c0 1.3 1.2 2.3 2.5 2.3.9 0 1.9-.5 2.5-1.5" />
    </Svg>
  ),
  Nfts: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="M3 16.5l4.5-3.5 3.5 2.5L15 11l6 5.5" />
    </Svg>
  ),
  Stablecoins: (p: IconProps) => (
    <Svg {...p}>
      <path d="M17 3l3 3-3 3" />
      <path d="M20 6H9a5 5 0 000 10h1" />
      <path d="M7 21l-3-3 3-3" />
      <path d="M4 18h11a5 5 0 000-10h-1" />
    </Svg>
  ),
  Contracts: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </Svg>
  ),
  Bridges: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 18V8" />
      <path d="M20 18V8" />
      <path d="M4 11c2.5 3 5 4.5 8 4.5S17.5 14 20 11" />
      <path d="M2 18h20" />
    </Svg>
  ),
  Analytics: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20H2" />
    </Svg>
  ),
  Rankings: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7 4h10v5a5 5 0 01-10 0V4z" />
      <path d="M7 6H4.5a2 2 0 001.6 3.7C7 9.4 8 8 8 7" />
      <path d="M17 6h2.5a2 2 0 01-1.6 3.7C17 9.4 16 8 16 7" />
    </Svg>
  ),
  Explorer: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Svg>
  ),
  Wallet: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 7H5a2 2 0 00-2 2v8a2 2 0 002 2h15a1 1 0 001-1V8a1 1 0 00-1-1z" />
      <path d="M16 12h.01" />
      <path d="M2 9V7a2 2 0 012-2h13" />
    </Svg>
  ),
  Compare: (p: IconProps) => (
    <Svg {...p}>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M4 16V6a2 2 0 012-2h10" />
    </Svg>
  ),
  Alerts: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 9a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.7 1.7 0 003.4 0" />
    </Svg>
  ),
  Watchlist: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z" />
    </Svg>
  ),
  Settings: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  ),
  Search: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </Svg>
  ),
  Moon: (p: IconProps) => (
    <Svg {...p}>
      <path d="M21 14.5A8.5 8.5 0 119.5 3 7 7 0 0021 14.5z" />
    </Svg>
  ),
  Sun: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  ),
  Chevron: (p: IconProps) => (
    <Svg {...p}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  ),
  Tvl: (p: IconProps) => (
    <Svg {...p}>
      <path d="M20 7H5a2 2 0 00-2 2v8a2 2 0 002 2h15a1 1 0 001-1V8a1 1 0 00-1-1z" />
      <path d="M16 12h.01" />
      <path d="M2 9V7a2 2 0 012-2h13" />
    </Svg>
  ),
  Tx: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 7h12M15 3l4 4-4 4" />
      <path d="M17 17H5M9 21l-4-4 4-4" />
    </Svg>
  ),
  Users: (p: IconProps) => (
    <Svg {...p}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </Svg>
  ),
  Blocks: (p: IconProps) => (
    <Svg {...p}>
      <path d="M14 2H7a2 2 0 00-2 2v16a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 2v6h6M9 13h6M9 17h4" />
    </Svg>
  ),
  Gas: (p: IconProps) => (
    <Svg {...p}>
      <path d="M13 2L4 14h7l-1 8 10-14h-7l1-6z" />
    </Svg>
  ),
  Menu: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Svg>
  ),
  Discord: (p: IconProps) => (
    <Svg {...p}>
      <path d="M8.5 14.5s.8.8 3.5.8 3.5-.8 3.5-.8" />
      <path d="M8.2 10.2h.01M15.8 10.2h.01" />
      <path d="M6.8 5.8S8.2 5 12 5s5.2.8 5.2.8l1.3 4.2a14 14 0 01.7 5.2s-1.7 1.8-5.2 1.8c0 0-.7-1-1-1.4a8 8 0 01-4 0c-.3.4-1 1.4-1 1.4-3.5 0-5.2-1.8-5.2-1.8a14 14 0 01.7-5.2L6.8 5.8z" />
    </Svg>
  ),
  X: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4.5 4.5l15 15" />
      <path d="M19.5 4.5l-15 15" />
    </Svg>
  ),
  Github: (p: IconProps) => (
    <Svg {...p}>
      <path d="M9 19c-4.3 1.4-4.3-2.1-6-2.5" />
      <path d="M15 22v-3.9a3.4 3.4 0 00-.9-2.6c3-.3 6.1-1.5 6.1-6.6a5.1 5.1 0 00-1.4-3.5 4.7 4.7 0 00-.1-3.5S17.3 2.8 15 4.2a12.3 12.3 0 00-6 0C6.7 2.8 5.3 3.4 5.3 3.4a4.7 4.7 0 00-.1 3.5A5.1 5.1 0 003.8 10.4c0 5.1 3.1 6.3 6.1 6.6a3.4 3.4 0 00-.9 2.6V22" />
    </Svg>
  ),
  Activity: (p: IconProps) => (
    <Svg {...p}>
      <path d="M22 12h-4l-3 7L9 5l-3 7H2" />
    </Svg>
  ),
  Dex: (p: IconProps) => (
    <Svg {...p}>
      <path d="M7 7h12M15 3l4 4-4 4" />
      <path d="M17 17H5M9 21l-4-4 4-4" />
    </Svg>
  ),
  Perps: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 17l6-6 4 4 7-8" />
      <path d="M14 7h6v6" />
    </Svg>
  ),
  Lending: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M8 6V4M16 6V4" />
    </Svg>
  ),
  Yield: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3v18" />
      <path d="M7 8c0-2 2.2-3.5 5-3.5s5 1.5 5 3.5-2.2 3-5 3.5-5 1.5-5 3.5 2.2 3.5 5 3.5 5-1.5 5-3.5" />
    </Svg>
  ),
  LiquidStaking: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  ),
  Restaking: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 12a8 8 0 0114.5-4.5" />
      <path d="M20 12a8 8 0 01-14.5 4.5" />
      <path d="M18 3v5h-5M6 21v-5h5" />
    </Svg>
  ),
  Rwa: (p: IconProps) => (
    <Svg {...p}>
      <path d="M3 21h18" />
      <path d="M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6" />
    </Svg>
  ),
  Oracle: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
    </Svg>
  ),
  Infra: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="11" width="7" height="10" rx="1" />
      <rect x="14" y="3" width="7" height="18" rx="1" />
      <path d="M6 15h1M6 18h1M17 7h1M17 11h1M17 15h1" />
    </Svg>
  ),
  Grid: (p: IconProps) => (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </Svg>
  ),
  Layers: (p: IconProps) => (
    <Svg {...p}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
      <path d="M3 17l9 5 9-5" />
    </Svg>
  ),
  Volume: (p: IconProps) => (
    <Svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </Svg>
  ),
  Fees: (p: IconProps) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v10M9.5 9.5c.7-1 1.8-1.5 2.5-1.5 1.4 0 2.5.8 2.5 2s-1 1.8-2.5 2.2S9.5 13.2 9.5 14.7c0 1.3 1.2 2.3 2.5 2.3.9 0 1.9-.5 2.5-1.5" />
    </Svg>
  ),
  Logo: (p: IconProps) => (
    <svg
      width={p.size ?? 16}
      height={p.size ?? 16}
      viewBox="0 0 24 24"
      fill="none"
      className={p.className}
      aria-hidden
    >
      <path
        d="M12 3L4.5 19h3.2l1.4-3.2h6.2L16.7 19H20L12 3zm0 5.2l2.2 5.1H9.8L12 8.2z"
        fill="currentColor"
      />
    </svg>
  ),
};
