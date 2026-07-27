const RPC =
  import.meta.env.VITE_ARC_RPC_URL ??
  (import.meta.env.DEV ? "/arcrpc" : "https://rpc.testnet.arc.network");

type RpcTx = {
  hash: string;
  from: string;
  to?: string | null;
  input?: string;
};

type RpcBlock = {
  number: string;
  hash: string;
  timestamp: string;
  transactions: RpcTx[] | string[];
};

async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} -> ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

const METHODS: Record<string, string> = {
  "0xa9059cbb": "transfer",
  "0x095ea7b3": "approve",
  "0x23b872dd": "transferFrom",
  "0x2e1a7d4d": "withdraw",
  "0x3593564c": "execute",
  "0x5c975abb": "deposit",
};

function methodOf(input?: string) {
  if (!input || input === "0x") return "transfer";
  return METHODS[input.slice(0, 10).toLowerCase()] ?? input.slice(0, 10);
}

export type LiveTx = {
  hash: string;
  method: string;
  from: { hash: string };
  timestamp: string;
};

export type LiveBlock = {
  number: number;
  hash: string;
  txCount: number;
  timestamp: string;
  txs: LiveTx[];
};

function mapBlock(block: RpcBlock): LiveBlock {
  const ts = new Date(Number.parseInt(block.timestamp, 16) * 1000).toISOString();
  const txs: LiveTx[] = [];
  for (const tx of block.transactions ?? []) {
    if (typeof tx === "string") continue;
    txs.push({
      hash: tx.hash,
      method: methodOf(tx.input),
      from: { hash: tx.from },
      timestamp: ts,
    });
  }
  return {
    number: Number.parseInt(block.number, 16),
    hash: block.hash,
    txCount: txs.length || (block.transactions?.length ?? 0),
    timestamp: ts,
    txs: txs.reverse(),
  };
}

export async function fetchLatestRpcBlocks(limit = 12): Promise<LiveBlock[]> {
  const tipHex = await rpc<string>("eth_blockNumber");
  const tip = Number.parseInt(tipHex, 16);
  const heights = Array.from({ length: limit }, (_, i) => tip - i).filter((h) => h >= 0);
  const blocks = await Promise.all(
    heights.map((h) =>
      rpc<RpcBlock>("eth_getBlockByNumber", [`0x${h.toString(16)}`, true]),
    ),
  );
  return blocks.filter(Boolean).map(mapBlock);
}

export async function fetchLatestRpcTxs(limit = 12): Promise<LiveTx[]> {
  const blocks = await fetchLatestRpcBlocks(6);
  const out: LiveTx[] = [];
  for (const b of blocks) {
    for (const tx of b.txs) {
      out.push(tx);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function subscribeRpcBlocks(onBlock: (block: LiveBlock) => void): () => void {
  const WS = import.meta.env.VITE_ARC_WS_URL ?? "wss://rpc.testnet.arc.network";
  let ws: WebSocket | null = null;
  let closed = false;
  let retry = 0;
  let reconnect = 0;
  let subId: string | null = null;
  let last = 0;

  const handleHead = async (numberHex: string) => {
    const n = Number.parseInt(numberHex, 16);
    if (!Number.isFinite(n) || n <= last) return;
    last = n;
    const raw = await rpc<RpcBlock>("eth_getBlockByNumber", [numberHex, true]);
    if (!raw) return;
    onBlock(mapBlock(raw));
  };

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(WS);

    ws.onopen = () => {
      retry = 0;
      ws?.send(
        JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_subscribe",
          params: ["newHeads"],
        }),
      );
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as {
          id?: number;
          result?: string;
          method?: string;
          params?: { subscription?: string; result?: { number?: string } };
        };
        if (msg.id === 1 && typeof msg.result === "string") {
          subId = msg.result;
          return;
        }
        if (msg.method === "eth_subscription" && msg.params?.result?.number) {
          if (subId && msg.params.subscription && msg.params.subscription !== subId) {
            return;
          }
          void handleHead(msg.params.result.number);
        }
      } catch {
        // ignore
      }
    };

    ws.onclose = () => {
      if (closed) return;
      const wait = Math.min(8_000, 400 * 2 ** retry++);
      reconnect = window.setTimeout(connect, wait);
    };

    ws.onerror = () => ws?.close();
  };

  connect();

  return () => {
    closed = true;
    window.clearTimeout(reconnect);
    ws?.close();
  };
}
