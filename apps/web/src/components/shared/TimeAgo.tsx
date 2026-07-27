import { useEffect, useState } from "react";
import { ago } from "@/utils/format";

export function TimeAgo({ ts }: { ts: string | number }) {
  const [label, setLabel] = useState("—");

  useEffect(() => {
    const tick = () => setLabel(ago(ts));
    tick();
    const id = setInterval(tick, 1_000);
    return () => clearInterval(id);
  }, [ts]);

  return <span>{label}</span>;
}
