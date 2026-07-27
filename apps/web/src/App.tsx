import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAsyncData } from "@/hooks/useAsyncData";
import { prefetchCore } from "@/libs/prefetch";
import { arcscan } from "@/libs/arcscan";
import { AppRoutes } from "@/routes";

function useNetworkMeta() {
  return useAsyncData("networkMeta", async () => {
    const [blocks, stats] = await Promise.all([
      arcscan.blocks().catch(() => [] as Array<Record<string, unknown>>),
      arcscan.stats().catch(() => ({}) as Record<string, unknown>),
    ]);
    const latestBlock = (blocks[0]?.height ?? blocks[0]?.number ?? null) as
      | string
      | number
      | null;
    const avgBlockTime = Number(stats.average_block_time ?? 0) || undefined;
    const txToday = Number(stats.transactions_today ?? 0);
    const tps = txToday > 0 ? txToday / 86_400 : undefined;
    return { latestBlock, avgBlockTime, tps };
  });
}

export default function App() {
  const { data } = useNetworkMeta();

  useEffect(() => {
    prefetchCore();
  }, []);

  return (
    <BrowserRouter>
      <AppShell
        latestBlock={data?.latestBlock}
        avgBlockTime={data?.avgBlockTime}
        tps={data?.tps}
      >
        <AppRoutes />
      </AppShell>
    </BrowserRouter>
  );
}
