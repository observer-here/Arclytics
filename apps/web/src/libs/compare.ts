import { loadProtocolDetail, type ProtocolDetail } from "@/libs/api";

export async function loadCompareProtocolDetail(slug: string): Promise<ProtocolDetail | null> {
  return loadProtocolDetail(slug);
}
