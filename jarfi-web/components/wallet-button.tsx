"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState } from "react";
import { Wallet, ChevronDown, LogOut, Copy } from "lucide-react";

interface WalletButtonProps {
  compact?: boolean;
}

export function WalletButton({ compact = false }: WalletButtonProps) {
  const { publicKey, connect, disconnect, connecting, wallets, select } = useWallet();
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
              ? "inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:border-black/30 disabled:opacity-50"
              : "flex w-full items-center gap-2 rounded-lg border border-black/10 px-3 py-2 text-sm font-medium text-ink-muted transition hover:border-black/30 disabled:opacity-50"
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
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
                >
                  <img src={w.adapter.icon} alt={w.adapter.name} className="h-5 w-5 rounded" />
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
            ? "inline-flex items-center gap-1.5 rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
            : "flex w-full items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-700 transition hover:bg-green-100"
        }
      >
        <div className="h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
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
            className="flex w-full items-center gap-3 px-4 py-3 text-sm hover:bg-gray-50"
          >
            <Copy className="h-4 w-4 text-ink-muted" />
            {copied ? "Copied!" : "Copy address"}
          </button>
          <button
            onClick={() => { disconnect(); setShowMenu(false); }}
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
