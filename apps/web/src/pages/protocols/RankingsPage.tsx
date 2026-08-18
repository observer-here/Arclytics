import { ProtocolsTable } from "@/components/protocols/ProtocolsTable";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getProtocolRankings } from "@/libs/api";

export function RankingsPage() {
  const { data: rows, loading, error } = useAsyncData(
    "protocol-rankings-v11",
    () => getProtocolRankings().catch(() => []),
  );

  if (loading) return <div className="text-sm text-ink-400">Loading…</div>;
  if (error) return <div className="text-sm text-ink-400">{error}</div>;

  return <ProtocolsTable rows={rows ?? []} />;
}
