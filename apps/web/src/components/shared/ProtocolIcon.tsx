import { useState } from "react";
import { protocolLogo } from "@arclytics/protocols";
import { CATEGORY_ACCENT } from "@/config/ecosystem";

export function ProtocolIcon({
  slug,
  name,
  size = 20,
  category = "other",
}: {
  slug: string;
  name: string;
  size?: number;
  category?: string;
}) {
  const [broken, setBroken] = useState(false);
  const src = protocolLogo(slug);
  const letter = (name || "?").slice(0, 1).toUpperCase();
  const accent = CATEGORY_ACCENT[category] ?? "#6366f1";

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-lg bg-white object-contain"
        style={{ width: size, height: size }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
      />
    );
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-lg text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.42),
        background: `linear-gradient(135deg, ${accent}, #2563eb)`,
      }}
    >
      {letter}
    </span>
  );
}
