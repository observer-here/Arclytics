
export function AboutPage() {
  return (
    <div className="space-y-2.5">
      <div className="card space-y-3 p-5 text-sm text-ink-600">
        <p>
          Arclytics tracks TVL rankings, categories, tokens, and live network activity
          for Arc Testnet using ArcScan as the primary data source.
        </p>
        <p>
          Protocol TVL is computed from token balances on tracked vault, pool, and router contracts.
        </p>
      </div>
    </div>
  );
}
