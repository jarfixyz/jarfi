"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { Wallet, ChevronDown, LogOut, Copy } from "lucide-react";

export function WalletButton() {
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

  // Not connected — show connect button
  if (!publicKey) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu((v) => !v)}
          disabled={connecting}
          className="flex w-full items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-sol-purple hover:text-sol-purple disabled:opacity-50"
        >
          <Wallet className="h-4 w-4" />
          {connecting ? "Connecting…" : "Connect wallet"}
        </button>

        {showMenu && (
          <div className="absolute bottom-full left-0 mb-2 w-48 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
            {wallets
              .filter((w) => w.readyState === "Installed")
              .map((w) => (
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
              ))}
            {wallets.filter((w) => w.readyState === "Installed").length ===
              0 && (
              <div className="px-4 py-3 text-xs text-ink-muted">
                No wallets detected. Install Phantom or Solflare.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // Connected — show address + actions
  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg bg-surface-mint px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-surface-mint/80"
      >
        <div className="h-2 w-2 rounded-full bg-sol-green" />
        <span className="font-mono">{short}</span>
        <ChevronDown className="ml-auto h-3 w-3" />
      </button>

      {showMenu && (
        <div className="absolute bottom-full left-0 mb-2 w-48 overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl">
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
