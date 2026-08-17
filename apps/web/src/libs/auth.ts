import { Magic } from "magic-sdk";
import { API_BASE } from "./api";

export type AuthUser = {
  id: string;
  email: string;
  username: string | null;
  wallet: string | null;
  createdAt: number;
};

const TOKEN_KEY = "arclytics.session";
const USER_KEY = "arclytics.user";

const MAGIC_KEY =
  import.meta.env.VITE_MAGIC_PUBLISHABLE_KEY || "pk_live_DD2DA0A15C2214BC";

let magic: Magic | null | undefined;

function getMagic() {
  if (magic !== undefined) return magic;
  magic = MAGIC_KEY ? new Magic(MAGIC_KEY) : null;
  return magic;
}

function ping() {
  window.dispatchEvent(new Event("arc-auth"));
}

export function sessionToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function cachedUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function save(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  ping();
}

function clear() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  ping();
}

async function authFetch(path: string, init: RequestInit = {}) {
  const token = sessionToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  const raw = await res.text();
  let data: Record<string, unknown> = {};
  try {
    data = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    if (!res.ok) throw new Error(res.status === 502 ? "API is restarting, try again" : `auth ${res.status}`);
  }
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `auth ${res.status}`);
  return data;
}

async function finishDid(didToken: string) {
  const data = (await authFetch("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ didToken }),
  })) as { token: string; user: AuthUser };
  save(data.token, data.user);
  return data.user;
}

export async function loginWithMagic() {
  const client = getMagic();
  if (!client) throw new Error("Magic is not configured");
  let did = "";
  await client.wallet.connectWithUI().on("id-token-created", ({ idToken }) => {
    did = idToken;
  });
  if (!did) did = (await client.user.getIdToken()) ?? "";
  if (!did) throw new Error("Login cancelled");
  return finishDid(did);
}

export async function refreshMe() {
  const token = sessionToken();
  if (!token) return null;
  try {
    const data = (await authFetch("/v1/auth/me")) as { user: AuthUser };
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    ping();
    return data.user;
  } catch {
    clear();
    return null;
  }
}

export async function logout() {
  try {
    await getMagic()?.user.logout();
  } catch {
    /* ignore */
  }
  try {
    await authFetch("/v1/auth/logout", { method: "POST" });
  } catch {
    /* ignore */
  }
  clear();
}

export async function patchUsername(username: string) {
  const data = (await authFetch("/v1/auth/username", {
    method: "PATCH",
    body: JSON.stringify({ username }),
  })) as { user: AuthUser };
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  ping();
  return data.user;
}

export function subscribeAuth(fn: () => void) {
  window.addEventListener("arc-auth", fn);
  return () => window.removeEventListener("arc-auth", fn);
}
