"use client";

import { useMemo } from "react";
import { clusterApiUrl } from "@solana/web3.js";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";

// Type casts: wallet adapter compiled with React 19 types, project uses React 18
const CP = ConnectionProvider as React.ComponentType<{
  endpoint: string;
  children: React.ReactNode;
}>;
const WP = WalletProvider as React.ComponentType<{
  wallets: never[];
  autoConnect: boolean;
  children: React.ReactNode;
}>;

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

// ---------------------------------------------------------------------------
// Privy provider (wallet + Google / Twitter / email login)
// Requires NEXT_PUBLIC_PRIVY_APP_ID env var — get it at privy.io
// ---------------------------------------------------------------------------

function PrivyProviderWrapper({ children }: { children: React.ReactNode }) {
  // Dynamic import to avoid build errors when privy is not yet configured
  const { PrivyProvider } = require("@privy-io/react-auth");
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? clusterApiUrl("mainnet-beta");

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID!}
      config={{
        loginMethods: ["wallet", "google", "twitter", "email"],
        appearance: {
          theme: "light",
          accentColor: "#9945FF",
          logo: "/favicon.ico",
        },
        embeddedWallets: {
          createOnLogin: "users-without-wallets",
          requireUserPasswordOnCreate: false,
        },
        solanaClusters: [{ name: "mainnet-beta", rpcUrl }],
      }}
    >
      {children}
    </PrivyProvider>
  );
}

// ---------------------------------------------------------------------------
// Wallet-only provider (no Privy — used when NEXT_PUBLIC_PRIVY_APP_ID is not set)
// ---------------------------------------------------------------------------

function WalletOnlyProvider({ children }: { children: React.ReactNode }) {
  const network = WalletAdapterNetwork.Mainnet;
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

// ---------------------------------------------------------------------------
// Root provider — picks Privy if APP_ID is set, else wallet-only
// ---------------------------------------------------------------------------

export function Providers({ children }: { children: React.ReactNode }) {
  if (PRIVY_APP_ID) {
    return <PrivyProviderWrapper>{children}</PrivyProviderWrapper>;
  }
  return <WalletOnlyProvider>{children}</WalletOnlyProvider>;
}
