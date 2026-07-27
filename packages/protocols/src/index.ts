import type { ProtocolConfig } from "@arclytics/types";
import { cctp } from "./cctp";
import { flowswap } from "./flowswap";
import { xylonet } from "./xylonet";

export const protocols: ProtocolConfig[] = [xylonet, flowswap, cctp];

export function getProtocol(slug: string): ProtocolConfig | undefined {
  return protocols.find((p) => p.slug === slug);
}

export * from "./xylonet";
export * from "./flowswap";
export * from "./cctp";
