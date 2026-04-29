"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { Wallet, ChevronDown, LogOut, Copy, Loader2 } from "lucide-react";

interface WalletButtonProps {
  compact?: boolean;
}

const HAS_PRIVY = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// ---------------------------------------------------------------------------
// Privy-aware login button — shows social + wallet options
// ---------------------------------------------------------------------------

function PrivyLoginButton({ compact }: { compact: boolean }) {
  const { usePrivy } = require("@privy-io/react-auth");
  const { ready, authenticated, user, login, logout } = usePrivy();
  const [showMenu, setShowMenu] = useState(false);

  if (!ready) {
    return (
      <button
        disabled
        className={
          compact
            ? "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink-muted opacity-50"
            : "flex w-full items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-ink-muted opacity-50"
        }
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading…
      </button>
    );
  }

  if (!authenticated) {
    return (
      <button
        onClick={login}
        className={
          compact
            ? "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-sol-purple hover:text-sol-purple"
            : "flex w-full items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-sol-purple hover:text-sol-purple"
        }
      >
        <Wallet className="h-4 w-4 flex-shrink-0" />
        {compact ? "Sign in" : "Connect wallet"}
      </button>
    );
  }

  const displayName =
    user?.wallet?.address
      ? `${user.wallet.address.slice(0, 4)}…${user.wallet.address.slice(-4)}`
      : user?.email?.address?.split("@")[0] ??
        user?.google?.name?.split(" ")[0] ??
        user?.twitter?.username ??
        "Connected";

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu((v) => !v)}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-full bg-surface-mint px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-surface-mint/80"
            : "flex w-full items-center gap-2 rounded-lg bg-surface-mint px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-surface-mint/80"
        }
      >
        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-sol-green" />
        <span className="font-mono">{displayName}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>

      {showMenu && (
        <div
          className={`absolute z-50 mt-2 w-52 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl ${
            compact ? "right-0 top-full" : "bottom-full left-0 mb-2"
          }`}
        >
          {user?.wallet?.address && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(user.wallet!.address);
                setShowMenu(false);
              }}
              className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-surface-lavender"
            >
              <Copy className="h-4 w-4 text-ink-muted" />
              Copy address
            </button>
          )}
          <button
            onClick={() => {
              logout();
              setShowMenu(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wallet-adapter button — used when Privy is not configured
// ---------------------------------------------------------------------------

function WalletAdapterButton({ compact }: { compact: boolean }) {
  const { publicKey, connect, disconnect, connecting, wallets, select } =
    useWallet();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const short = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : null;

  const handleCopy = () => {
    if (!publicKey) return;
    navigator.clipboard.writeText(publicKey.toBase58());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const installedWallets = wallets.filter((w) => w.readyState === "Installed");

  if (!publicKey) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu((v) => !v)}
          disabled={connecting}
          className={
            compact
              ? "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-sol-purple hover:text-sol-purple disabled:opacity-50"
              : "flex w-full items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-sol-purple hover:text-sol-purple disabled:opacity-50"
          }
        >
          <Wallet className="h-4 w-4 flex-shrink-0" />
          {connecting ? "Connecting…" : compact ? "Connect" : "Connect wallet"}
        </button>

        {showMenu && (
          <div
            className={`absolute z-50 mt-2 w-52 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl ${
              compact ? "right-0 top-full" : "bottom-full left-0 mb-2"
            }`}
          >
            {installedWallets.length > 0 ? (
              installedWallets.map((w) => (
                <button
                  key={w.adapter.name}
                  onClick={() => {
                    select(w.adapter.name);
                    connect().catch(() => {});
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-surface-lavender"
                >
                  <img
                    src={w.adapter.icon}
                    alt={w.adapter.name}
                    className="h-5 w-5 rounded"
                  />
                  {w.adapter.name}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-xs text-ink-muted">
                No wallets detected. Install Phantom or Solflare.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu((v) => !v)}
        className={
          compact
            ? "inline-flex items-center gap-1.5 rounded-full bg-surface-mint px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-surface-mint/80"
            : "flex w-full items-center gap-2 rounded-lg bg-surface-mint px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-surface-mint/80"
        }
      >
        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-sol-green" />
        <span className="font-mono">{short}</span>
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>

      {showMenu && (
        <div
          className={`absolute z-50 mt-2 w-48 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl ${
            compact ? "right-0 top-full" : "bottom-full left-0 mb-2"
          }`}
        >
          <button
            onClick={handleCopy}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-surface-lavender"
          >
            <Copy className="h-4 w-4 text-ink-muted" />
            {copied ? "Copied!" : "Copy address"}
          </button>
          <button
            onClick={() => {
              disconnect();
              setShowMenu(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-3 text-sm text-red-500 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public export — auto-picks Privy or wallet-adapter based on env
// ---------------------------------------------------------------------------

export function WalletButton({ compact = false }: WalletButtonProps) {
  if (HAS_PRIVY) {
    return <PrivyLoginButton compact={compact} />;
  }
  return <WalletAdapterButton compact={compact} />;
}
