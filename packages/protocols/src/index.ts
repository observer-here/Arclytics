import type { ProtocolConfig } from "@arclytics/types";
import { aplp } from "./aplp";
import { arclp } from "./arclp";
import { arcswap } from "./arcswap";
import { arcvault } from "./arcvault";
import { cctp } from "./cctp";
import { curve } from "./curve";
import { defiOnArc } from "./defi-on-arc";
import { flowswap } from "./flowswap";
import { gateway } from "./gateway";
import { lunex } from "./lunex";
import { payx } from "./payx";
import { perpdex } from "./perpdex";
import { sendarc } from "./sendarc";
import { settlenet } from "./settlenet";
import { synthra } from "./synthra";
import { tower } from "./tower";
import { unitflow } from "./unitflow";
import { warpdex } from "./warpdex";
import { wusdc } from "./wusdc";
import { xylonet } from "./xylonet";

export const protocols: ProtocolConfig[] = [
  xylonet,
  synthra,
  defiOnArc,
  wusdc,
  aplp,
  perpdex,
  curve,
  arclp,
  unitflow,
  lunex,
  flowswap,
  gateway,
  arcvault,
  warpdex,
  payx,
  sendarc,
  tower,
  settlenet,
  arcswap,
  cctp,
];

export function getProtocol(slug: string): ProtocolConfig | undefined {
  return protocols.find((p) => p.slug === slug);
}

export * from "./logos";

export * from "./xylonet";
export * from "./synthra";
export * from "./defi-on-arc";
export * from "./wusdc";
export * from "./aplp";
export * from "./perpdex";
export * from "./curve";
export * from "./arclp";
export * from "./unitflow";
export * from "./lunex";
export * from "./flowswap";
export * from "./gateway";
export * from "./arcvault";
export * from "./warpdex";
export * from "./payx";
export * from "./sendarc";
export * from "./tower";
export * from "./settlenet";
export * from "./arcswap";
export * from "./cctp";

export { details as xylonetDetails } from "./xylonet/details";
export { details as synthraDetails } from "./synthra/details";
export { details as defiOnArcDetails } from "./defi-on-arc/details";
export { details as wusdcDetails } from "./wusdc/details";
export { details as aplpDetails } from "./aplp/details";
export { details as perpdexDetails } from "./perpdex/details";
export { details as curveDetails } from "./curve/details";
export { details as arclpDetails } from "./arclp/details";
export { details as unitflowDetails } from "./unitflow/details";
export { details as lunexDetails } from "./lunex/details";
export { details as flowswapDetails } from "./flowswap/details";
export { details as gatewayDetails } from "./gateway/details";
export { details as arcvaultDetails } from "./arcvault/details";
export { details as warpdexDetails } from "./warpdex/details";
export { details as payxDetails } from "./payx/details";
export { details as sendarcDetails } from "./sendarc/details";
export { details as towerDetails } from "./tower/details";
export { details as settlenetDetails } from "./settlenet/details";
export { details as arcswapDetails } from "./arcswap/details";
export { details as cctpDetails } from "./cctp/details";
