import { BrowserRouter } from "react-router-dom";
import { useEffect } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAsyncData } from "@/hooks/useAsyncData";
import { loadNetworkMeta, prefetchCore } from "@/libs/prefetch";
import { AppRoutes } from "@/routes";

export default function App() {
  const { data } = useAsyncData("networkMeta", loadNetworkMeta);

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
