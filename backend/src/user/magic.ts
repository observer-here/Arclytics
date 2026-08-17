import { secp256k1 } from "@noble/curves/secp256k1.js";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { bytesToHex, hexToBytes } from "@noble/hashes/utils.js";
import type { Env } from "../lib/env";

const SKEW = 300;
const MAGIC_API = "https://api.toaster.magic.link";

function b64json(did: string): [string, string] {
  const pad = did.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as [string, string];
  if (!Array.isArray(parsed) || parsed.length !== 2) throw new Error("malformed DID token");
  return parsed;
}

function personalHash(message: string) {
  const msg = new TextEncoder().encode(message);
  const prefix = new TextEncoder().encode(`\x19Ethereum Signed Message:\n${msg.length}`);
  const out = new Uint8Array(prefix.length + msg.length);
  out.set(prefix);
  out.set(msg, prefix.length);
  return keccak_256(out);
}

function recoverAddress(claim: string, proof: string) {
  const sig = hexToBytes(proof.startsWith("0x") ? proof.slice(2) : proof);
  if (sig.length !== 65) throw new Error("malformed DID token");
  let v = sig[64];
  if (v >= 27) v -= 27;
  if (v > 3) throw new Error("malformed DID token");
  const recovered = new Uint8Array(65);
  recovered[0] = v;
  recovered.set(sig.subarray(0, 64), 1);
  const pub = secp256k1.recoverPublicKey(recovered, personalHash(claim), { prehash: false });
  const uncompressed = secp256k1.Point.fromBytes(pub).toBytes(false);
  return `0x${bytesToHex(keccak_256(uncompressed.subarray(1)).slice(-20))}`;
}

export function verifyDid(didToken: string) {
  const [proof, claimStr] = b64json(didToken.trim());
  const claim = JSON.parse(claimStr) as { iss?: string; ext?: number; nbf?: number };
  if (!claim.iss?.startsWith("did:ethr:")) throw new Error("malformed DID token");
  const now = Math.floor(Date.now() / 1000);
  if (typeof claim.ext === "number" && now > claim.ext + SKEW) throw new Error("DID token expired");
  if (typeof claim.nbf === "number" && now + SKEW < claim.nbf) throw new Error("DID token not valid yet");
  const addr = recoverAddress(claimStr, proof);
  if (claim.iss.slice("did:ethr:".length).toLowerCase() !== addr.toLowerCase()) {
    throw new Error("DID token signature mismatch");
  }
  return claim.iss;
}

type MagicUser = {
  email?: string | null;
  issuer?: string | null;
  public_address?: string | null;
  publicAddress?: string | null;
  message?: string;
  data?: MagicUser;
};

export async function magicIdentity(env: Env, didToken: string) {
  const secret = env.MAGIC_SECRET_KEY;
  if (!secret) throw new Error("MAGIC_SECRET_KEY missing");
  const issuer = verifyDid(didToken);
  const res = await fetch(`${MAGIC_API}/v1/admin/user?issuer=${encodeURIComponent(issuer)}`, {
    headers: { "X-Magic-Secret-Key": secret },
  });
  const raw = await res.text();
  let body: MagicUser = {};
  try {
    body = JSON.parse(raw) as MagicUser;
  } catch {
    throw new Error(res.ok ? "magic user lookup failed" : `magic lookup ${res.status}`);
  }
  const row = body.data ?? body;
  const email = row.email?.trim().toLowerCase();
  if (!res.ok || !email) throw new Error(body.message || "magic user lookup failed");
  return {
    email,
    issuer: row.issuer ?? issuer,
    wallet: row.public_address ?? row.publicAddress ?? null,
  };
}
