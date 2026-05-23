"use client";

import { useMemo } from "react";
import {
  useAnchorWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { JarfiClient } from "@jarfi/sdk";

export function useJarfiClient(): JarfiClient | null {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();
  return useMemo(() => {
    if (!wallet) return null;
    return new JarfiClient(connection, wallet);
  }, [connection, wallet]);
}
