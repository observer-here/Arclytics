/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ARCSCAN_BASE_URL?: string;
  readonly VITE_ARCSCAN_STATS_URL?: string;
  readonly VITE_ARC_RPC_URL?: string;
  readonly VITE_ARC_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
