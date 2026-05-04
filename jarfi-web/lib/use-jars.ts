"use client";

import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { fetchJarsByOwner, fetchContributions } from "./program";
import type { JarAccount, ContributionAccount } from "./program";

export type { JarAccount, ContributionAccount };

export function useJars() {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const [jars, setJars] = useState<JarAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!publicKey || !wallet?.adapter) {
      setJars([]);
      return;
    }

    setLoading(true);
    setError(null);

    fetchJarsByOwner(connection, publicKey, wallet.adapter as never)
      .then(setJars)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [publicKey, connection, wallet, tick]);

  const refresh = () => setTick((t) => t + 1);

  return { jars, loading, error, refresh };
}

export function useContributions(jarPubkey: string | null) {
  const { wallet } = useWallet();
  const { connection } = useConnection();
  const [contributions, setContributions] = useState<ContributionAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jarPubkey || !wallet?.adapter) {
      setContributions([]);
      return;
    }

    const { PublicKey } = require("@solana/web3.js");
    setLoading(true);

    fetchContributions(connection, new PublicKey(jarPubkey), wallet.adapter as never)
      .then(setContributions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [jarPubkey, connection, wallet]);

  return { contributions, loading };
}
