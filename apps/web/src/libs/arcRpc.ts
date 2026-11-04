const RPC =
  import.meta.env.VITE_ARC_RPC_URL ??
  (import.meta.env.DEV ? "/arcrpc" : "https://rpc.testnet.arc.io");

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

const LIVE_N = 12;

type LiveSnap = {
  txs: LiveTx[];
  blocks: LiveBlock[];
  connected: boolean;
  freshTx: Set<string>;
  freshBlock: Set<number>;
};

let snap: LiveSnap = {
  txs: [],
  blocks: [],
  connected: false,
  freshTx: new Set(),
  freshBlock: new Set(),
};
const listeners = new Set<() => void>();
let started = false;
let pollTimer = 0;
const seenTx = new Set<string>();
const seenBlock = new Set<number>();
let txFreshT = 0;
let blockFreshT = 0;

function txsFrom(blocks: LiveBlock[], limit = LIVE_N) {
  const out: LiveTx[] = [];
  for (const b of blocks) {
    for (const tx of b.txs) {
      out.push(tx);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

function emit() {
  for (const fn of listeners) fn();
}

function patch(p: Partial<LiveSnap>) {
  snap = { ...snap, ...p };
  emit();
}

function flashTx(hashes: string[]) {
  if (!hashes.length) return;
  patch({ freshTx: new Set(hashes) });
  window.clearTimeout(txFreshT);
  txFreshT = window.setTimeout(() => patch({ freshTx: new Set() }), 900);
}

function flashBlock(nums: number[]) {
  if (!nums.length) return;
  patch({ freshBlock: new Set(nums) });
  window.clearTimeout(blockFreshT);
  blockFreshT = window.setTimeout(() => patch({ freshBlock: new Set() }), 900);
}

function applyBlocks(blocks: LiveBlock[], highlight: boolean) {
  const novelB = blocks.filter((b) => !seenBlock.has(b.number)).map((b) => b.number);
  const txs = txsFrom(blocks);
  const novelT = txs.filter((t) => !seenTx.has(t.hash)).map((t) => t.hash);
  for (const b of blocks) seenBlock.add(b.number);
  for (const t of txs) seenTx.add(t.hash);
  patch({ blocks: blocks.slice(0, LIVE_N), txs, connected: true });
  if (highlight && novelB.length) flashBlock(novelB);
  if (highlight && novelT.length) flashTx(novelT);
}

function onWsStatus(up: boolean) {
  if (up) {
    if (snap.txs.length || snap.blocks.length) patch({ connected: true });
    return;
  }
  patch({ connected: false });
}

function poll() {
  void fetchLatestRpcBlocks(LIVE_N)
    .then((blocks) => applyBlocks(blocks, true))
    .catch(() => {
      if (!snap.txs.length && !snap.blocks.length) patch({ connected: false });
    });
}

export function ensureLiveFeed() {
  if (started) return;
  started = true;

  void fetchLatestRpcBlocks(LIVE_N)
    .then((blocks) => applyBlocks(blocks, false))
    .catch(() => patch({ connected: false }));

  subscribeRpcBlocks(
    (block) => {
      if (seenBlock.has(block.number)) return;
      applyBlocks([block, ...snap.blocks], true);
    },
    onWsStatus,
  );

  pollTimer = window.setInterval(poll, 5_000);
}

export function peekLiveFeed() {
  return snap;
}

export function subscribeLiveFeed(fn: () => void) {
  listeners.add(fn);
  ensureLiveFeed();
  return () => listeners.delete(fn);
}

export function subscribeRpcBlocks(
  onBlock: (block: LiveBlock) => void,
  onStatus?: (connected: boolean) => void,
): () => void {
  const WS = import.meta.env.VITE_ARC_WS_URL ?? "wss://rpc.testnet.arc.io";
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
    try {
      const raw = await rpc<RpcBlock>("eth_getBlockByNumber", [numberHex, true]);
      if (!raw) return;
      onBlock(mapBlock(raw));
    } catch {
      // Arc RPC can flap (520); skip this head and wait for the next one
    }
  };

  const connect = () => {
    if (closed) return;
    ws = new WebSocket(WS);

    ws.onopen = () => {
      retry = 0;
      onStatus?.(true);
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
          onStatus?.(true);
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
      onStatus?.(false);
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
