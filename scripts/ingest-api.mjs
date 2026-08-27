const mode = process.argv[2] ?? "tvl";
const base = (process.env.API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const q =
  mode === "full"
    ? ""
    : mode === "tokens"
      ? "?mode=tokens"
      : mode === "wallets-discover"
        ? "?mode=wallets-discover"
        : mode === "wallets-refresh" || mode === "wallets"
          ? "?mode=wallets-refresh"
          : mode === "batch"
            ? "?mode=batch"
            : "?mode=tvl";
const headers = process.env.INGEST_SECRET
  ? { authorization: `Bearer ${process.env.INGEST_SECRET}` }
  : {};

const timeoutMs = mode === "wallets-discover" ? 600_000 : 120_000;
const res = await fetch(`${base}/v1/ingest${q}`, {
  method: "POST",
  headers,
  signal: AbortSignal.timeout(timeoutMs),
});
const body = await res.text();
console.log(res.status, body);
