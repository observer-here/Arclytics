const mode = process.argv[2] ?? "tvl";
const base = (process.env.API_URL || "http://127.0.0.1:8787").replace(/\/$/, "");
const q =
  mode === "full"
    ? ""
    : mode === "tokens"
      ? "?mode=tokens"
      : mode === "wallets"
        ? "?mode=wallets"
        : mode === "batch"
          ? "?mode=batch"
          : "?mode=tvl";
const headers = process.env.INGEST_SECRET
  ? { authorization: `Bearer ${process.env.INGEST_SECRET}` }
  : {};

const res = await fetch(`${base}/v1/ingest${q}`, { method: "POST", headers });
const body = await res.text();
console.log(res.status, body);
