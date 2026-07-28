
export function ApiDocsPage() {
  return (
    <div>
      <div className="card p-5 text-sm">
        <p>
          Primary:{" "}
          <span className="font-mono text-arc-700">https://testnet.arcscan.app/api/v2</span>
        </p>
        <p className="text-ink-500">Arclytics reads ArcScan directly from the browser (via Vite proxy in dev).</p>
      </div>
    </div>
  );
}
