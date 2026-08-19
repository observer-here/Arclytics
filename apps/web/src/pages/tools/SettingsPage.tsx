import { useState, type ReactNode } from "react";
import { Icons } from "@/components/shared/Icons";
import { useAuth } from "@/hooks/useAuth";
import { useTheme, type Theme } from "@/hooks/useTheme";
import { loginWithMagic, logout, patchUsername } from "@/libs/auth";

function Row({
  icon,
  label,
  value,
  right,
  onClick,
  mono,
}: {
  icon: keyof typeof Icons;
  label: string;
  value: string;
  right?: ReactNode;
  onClick?: () => void;
  mono?: boolean;
}) {
  const Icon = Icons[icon];
  const inner = (
    <>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-500">
        <Icon size={14} />
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[11px] text-ink-400">{label}</span>
        <span className={`block truncate text-[13px] font-medium text-ink-800 ${mono ? "font-mono text-[12px]" : ""}`}>
          {value}
        </span>
      </span>
      {right}
    </>
  );
  const cls = "flex w-full items-center gap-3 border-b border-ink-200 px-4 py-3";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cls} hover:bg-ink-50`}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function Head({ icon, title }: { icon: keyof typeof Icons; title: string }) {
  const Icon = Icons[icon];
  return (
    <div className="flex items-center gap-2.5 border-b border-ink-200 px-4 py-3">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-arc-50 text-arc-600">
        <Icon size={15} />
      </span>
      <h2 className="text-[14px] font-semibold text-ink-900">{title}</h2>
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
      {children}
    </span>
  );
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-ink-400 hover:bg-ink-50 hover:text-ink-800"
    >
      {children}
    </button>
  );
}

function AccountCard() {
  const user = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.username ?? "");
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState<"id" | "wallet" | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user) {
    return (
      <section className="overflow-hidden rounded-xl border border-ink-200 bg-white">
        <Head icon="Users" title="Account" />
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-[13px] text-ink-500">Sign in to manage your account.</p>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await loginWithMagic();
              } catch (e) {
                console.error(e);
              } finally {
                setBusy(false);
              }
            }}
            className="shrink-0 rounded-lg bg-gradient-to-r from-arc-600 to-indigo-600 px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-60"
          >
            {busy ? "…" : "Login"}
          </button>
        </div>
      </section>
    );
  }

  const id = user.id.replace(/-/g, "");
  const shortId = `arc_${id.slice(0, 8)}…${id.slice(-4)}`;
  const shortWallet = user.wallet ? `${user.wallet.slice(0, 6)}…${user.wallet.slice(-4)}` : "";

  async function saveName() {
    setErr("");
    try {
      await patchUsername(name);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save");
    }
  }

  function copy(kind: "id" | "wallet", text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 1200);
  }

  return (
    <section className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <Head icon="Users" title="Account" />
      {editing ? (
        <div className="flex items-center gap-2 border-b border-ink-200 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-ink-50 text-ink-500">
            <Icons.Users size={14} />
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="min-w-0 flex-1 rounded-lg border border-ink-200 bg-ink-50 px-2.5 py-1.5 text-[13px] outline-none ring-arc-500 focus:bg-white focus:ring-1"
          />
          <button type="button" onClick={saveName} className="text-[12px] font-medium text-arc-600">
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-[12px] text-ink-500">
            Cancel
          </button>
        </div>
      ) : (
        <Row
          icon="Users"
          label="Username"
          value={user.username ? `@${user.username}` : "—"}
          right={
            <IconBtn
              label="Edit username"
              onClick={() => {
                setName(user.username ?? "");
                setEditing(true);
              }}
            >
              <Icons.Edit size={13} />
            </IconBtn>
          }
        />
      )}
      {err ? <p className="px-4 py-1.5 text-[12px] text-rose-600">{err}</p> : null}
      <Row icon="Mail" label="Email" value={user.email} right={<Badge>Verified</Badge>} />
      <Row
        icon="Wallet"
        label="Connected Wallet"
        value={user.wallet ? shortWallet : "Not connected"}
        mono={Boolean(user.wallet)}
        onClick={user.wallet ? () => copy("wallet", user.wallet!) : undefined}
        right={
          user.wallet ? (
            <span className="flex items-center gap-1">
              <Badge>Connected</Badge>
              {copied === "wallet" ? (
                <Icons.Verified size={13} className="text-emerald-600" />
              ) : (
                <Icons.Copy size={13} className="text-ink-400" />
              )}
            </span>
          ) : null
        }
      />
      <Row
        icon="Docs"
        label="Account ID"
        value={shortId}
        mono
        onClick={() => copy("id", user.id)}
        right={
          copied === "id" ? (
            <Icons.Verified size={13} className="text-emerald-600" />
          ) : (
            <Icons.Copy size={13} className="text-ink-400" />
          )
        }
      />
      <div className="flex justify-end px-4 py-3">
        <button
          type="button"
          onClick={() => void logout()}
          className="rounded-lg border border-rose-200 px-3 py-1.5 text-[12px] font-medium text-rose-600 hover:bg-rose-50"
        >
          Log out
        </button>
      </div>
    </section>
  );
}

const THEMES: Array<{ id: Theme; label: string; icon: keyof typeof Icons }> = [
  { id: "light", label: "Light", icon: "Sun" },
  { id: "dark", label: "Dark", icon: "Moon" },
  { id: "system", label: "System", icon: "Monitor" },
];

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  return (
    <section className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <Head icon="Palette" title="Appearance" />
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <span className="text-[13px] font-medium text-ink-800">Theme</span>
        <div className="flex rounded-lg bg-ink-50 p-0.5">
          {THEMES.map((t) => {
            const Icon = Icons[t.icon];
            const on = theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] ${
                  on ? "bg-white font-medium text-arc-700 shadow-sm" : "text-ink-500 hover:text-ink-800"
                }`}
              >
                <Icon size={13} />
                {t.label}
                <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-arc-600" : "bg-ink-300"}`} />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AboutCard() {
  return (
    <section className="overflow-hidden rounded-xl border border-ink-200 bg-white">
      <Head icon="Info" title="About" />
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3 text-[13px]">
        <span className="text-ink-400">Version</span>
        <span className="font-medium text-ink-800">v1.0.0</span>
      </div>
      <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3 text-[13px]">
        <span className="text-ink-400">Build</span>
        <span className="font-medium text-ink-800">May 15, 2026</span>
      </div>
      <p className="border-b border-ink-200 px-4 py-3 text-[13px] leading-relaxed text-ink-600">
        Arclytics is an analytics layer for the Arc ecosystem.
      </p>
      <div className="flex items-center gap-2 px-4 py-3">
        {[
          { href: "https://arc.network", label: "Website", icon: Icons.Globe },
          { href: "https://github.com", label: "GitHub", icon: Icons.Github },
          { href: "https://x.com", label: "X", icon: Icons.X },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            target="_blank"
            rel="noreferrer"
            aria-label={l.label}
            className="grid h-8 w-8 place-items-center rounded-full border border-ink-200 text-ink-500 hover:border-ink-300 hover:bg-ink-50 hover:text-ink-800"
          >
            <l.icon size={14} />
          </a>
        ))}
      </div>
    </section>
  );
}

export function SettingsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <AccountCard />
      <AppearanceCard />
      <AboutCard />
    </div>
  );
}
