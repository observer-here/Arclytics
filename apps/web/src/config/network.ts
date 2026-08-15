import { arcTestnet } from "@arclytics/chain";

export function getChain() {
  return arcTestnet;
}

export function explorerUrl(path: string) {
  const base = getChain().blockExplorers.default.url;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
