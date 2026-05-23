"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

function shortAddr(pk: string): string {
  return `${pk.slice(0, 4)}…${pk.slice(-4)}`;
}

export function ConnectButton() {
  const { publicKey, disconnect, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    padding: "9px 16px",
    fontSize: 13,
    fontWeight: 500,
    transition: "background-color .15s, color .15s, border-color .15s",
    fontFamily: "inherit",
  };

  if (publicKey) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        aria-label="Disconnect wallet"
        style={{
          ...base,
          background: "transparent",
          color: "#14151A",
          border: "0.5px solid rgba(20,21,26,0.14)",
        }}
      >
        {shortAddr(publicKey.toBase58())}
        <span aria-hidden style={{ fontSize: 14, lineHeight: 1 }}>
          ×
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setVisible(true)}
      disabled={connecting}
      style={{
        ...base,
        background: "transparent",
        color: "#14151A",
        border: "0.5px solid rgba(20,21,26,0.14)",
        opacity: connecting ? 0.6 : 1,
        cursor: connecting ? "default" : "pointer",
      }}
    >
      {connecting ? "Connecting…" : "Connect wallet"}
    </button>
  );
}
