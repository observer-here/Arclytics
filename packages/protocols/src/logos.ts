export const PROTOCOL_LOGOS: Record<string, string> = {
  xylonet: "/protocols/xylonet.png",
  synthra: "/protocols/synthra.png",
  "defi-on-arc": "/protocols/defi-on-arc.ico",
  wusdc: "/protocols/wusdc.png",
  aplp: "/protocols/aplp.jpg",
  curve: "/protocols/curve.png",
  arclp: "/protocols/arclp.png",
  unitflow: "/protocols/unitflow.jpg",
  lunex: "/protocols/lunex.png",
  gateway: "/protocols/gateway.png",
  arcvault: "/protocols/arcvault.png",
  warpdex: "/protocols/warpdex.png",
  payx: "/protocols/payx.svg",
  sendarc: "/protocols/sendarc.jpg",
  tower: "/protocols/tower.svg",
  settlenet: "/protocols/settlenet.ico",
  arcswap: "/protocols/arcswap.svg",
  cctp: "/protocols/cctp.png",
};

export function protocolLogo(slug: string): string | undefined {
  return PROTOCOL_LOGOS[slug];
}
