type Pt = { date: string; value: number };

function money(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

export function tvlSvg(title: string, data: Pt[]): string {
  const src = data.filter((p) => Number.isFinite(p.value));
  if (src.length < 2) return "";
  const step = Math.max(1, Math.ceil(src.length / 48));
  const pts = src.filter((_, i) => i % step === 0 || i === src.length - 1);
  const w = 640;
  const h = 200;
  const l = 52;
  const r = 16;
  const t = 28;
  const b = 28;
  const vals = pts.map((p) => p.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pad = (max - min) * 0.08 || max * 0.02 || 1;
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const span = hi - lo || 1;
  const x = (i: number) => l + (i / Math.max(pts.length - 1, 1)) * (w - l - r);
  const y = (v: number) => t + (1 - (v - lo) / span) * (h - t - b);
  const line = pts.map((p, i) => `${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${l},${h - b} ${line} ${x(pts.length - 1).toFixed(1)},${h - b}`;
  const ticks = [hi, (hi + lo) / 2, lo];
  const latest = pts[pts.length - 1];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" role="img">
  <title>${title}</title>
  <text x="${l}" y="16" font-size="12" font-family="system-ui,sans-serif" fill="#1e1b4b" font-weight="600">${title.replace(/[<>&]/g, "")} · ${money(latest.value)}</text>
  ${ticks
    .map((v) => {
      const yy = y(v);
      return `<line x1="${l}" x2="${w - r}" y1="${yy.toFixed(1)}" y2="${yy.toFixed(1)}" stroke="#e5e7eb"/><text x="${l - 6}" y="${(yy + 3).toFixed(1)}" text-anchor="end" font-size="9" font-family="system-ui,sans-serif" fill="#64748b">${money(v)}</text>`;
    })
    .join("")}
  <polygon points="${area}" fill="#7c3aed" fill-opacity="0.12"/>
  <polyline points="${line}" fill="none" stroke="#7c3aed" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${y(latest.value).toFixed(1)}" r="3.5" fill="#7c3aed"/>
  <text x="${l}" y="${h - 8}" font-size="9" font-family="system-ui,sans-serif" fill="#64748b">${pts[0].date}</text>
  <text x="${(l + w - r) / 2}" y="${h - 8}" text-anchor="middle" font-size="9" font-family="system-ui,sans-serif" fill="#64748b">${pts[Math.floor(pts.length / 2)].date}</text>
  <text x="${w - r}" y="${h - 8}" text-anchor="end" font-size="9" font-family="system-ui,sans-serif" fill="#64748b">${latest.date}</text>
</svg>`;
}
