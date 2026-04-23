"use client";

import { useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

// Type cast needed: wallet adapter was compiled with React 19 types, project uses React 18
const CP = ConnectionProvider as React.ComponentType<{ endpoint: string; children: React.ReactNode }>;
const WP = WalletProvider as React.ComponentType<{ wallets: never[]; autoConnect: boolean; children: React.ReactNode }>;

export function Providers({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl(network),
    [network]
  );
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  ) as never[];

  return (
    <CP endpoint={endpoint}>
      <WP wallets={wallets} autoConnect>
        {children}
      </WP>
    </CP>
  );
}
