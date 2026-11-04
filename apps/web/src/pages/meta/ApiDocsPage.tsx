
export function ApiDocsPage() {
  return (
    <div>
      <div className="card p-5 text-sm">
        <p>
          Primary:{" "}
          <span className="font-mono text-arc-700">https://explorer.testnet.arc.io/api/v2</span>
        </p>
        <p className="text-ink-500">Arclytics reads the explorer API through /arcscan and /arcstats.</p>
      </div>
    </div>
  );
}
