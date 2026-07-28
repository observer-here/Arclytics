import { tokenLogo } from "@arclytics/chain";
import { useState } from "react";

export function TokenIcon({
  address,
  src,
  symbol,
  size = 20,
}: {
  address?: string;
  src?: string | null;
  symbol?: string;
  size?: number;
}) {
  const [broken, setBroken] = useState(false);
  const resolved = (address ? tokenLogo(address) : undefined) ?? src ?? undefined;
  const letter = (symbol || "?").slice(0, 1).toUpperCase();
  const showImg = Boolean(resolved) && !broken;

  if (showImg) {
    return (
      <img
        src={resolved!}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full bg-ink-50 object-cover"
        style={{ width: size, height: size }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-indigo-50 font-semibold text-indigo-700"
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.45) }}
    >
      {letter}
    </span>
  );
}
