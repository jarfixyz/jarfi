"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { fetchJarsByOwner, fetchJarByPubkey, fetchContributions } from "./program";
import type { JarAccount, ContributionAccount } from "./program";

export type { JarAccount, ContributionAccount };

// localStorage key for known jar pubkeys per owner
function knownPubkeysKey(owner: string) { return `jar_pubkeys_${owner}`; }

function loadKnownPubkeys(owner: string): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(knownPubkeysKey(owner)) ?? "[]"); } catch { return []; }
}

function saveKnownPubkey(owner: string, pubkey: string) {
  if (typeof window === "undefined") return;
  const existing = loadKnownPubkeys(owner);
  if (!existing.includes(pubkey)) {
    localStorage.setItem(knownPubkeysKey(owner), JSON.stringify([...existing, pubkey]));
  }
}

export function useJars() {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const [chainJars, setChainJars]   = useState<JarAccount[]>([]);
  const [extraJars, setExtraJars]   = useState<JarAccount[]>([]);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [tick, setTick]             = useState(0);

  useEffect(() => {
    if (!publicKey || !wallet?.adapter) {
      setChainJars([]);
      setExtraJars([]);
      return;
    }

    const owner = publicKey.toBase58();
    setLoading(true);
    setError(null);

    fetchJarsByOwner(connection, publicKey, wallet.adapter as never)
      .then(async (jars) => {
        setChainJars(jars);
        // If chain returned nothing, fall back to locally-known pubkeys
        if (jars.length === 0) {
          const known = loadKnownPubkeys(owner);
          if (known.length > 0) {
            const fetched = await Promise.all(
              known.map(pk => fetchJarByPubkey(connection, new PublicKey(pk)).catch(() => null))
            );
            setExtraJars(fetched.filter(Boolean) as JarAccount[]);
          }
        } else {
          setExtraJars([]);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [publicKey, connection, wallet, tick]);

  // Merged list: chain jars are authoritative; extras fill in newly created ones
  const jars = useMemo(() => {
    const chainPks = new Set(chainJars.map(j => j.pubkey));
    return [...chainJars, ...extraJars.filter(j => !chainPks.has(j.pubkey))];
  }, [chainJars, extraJars]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  // Immediately show a newly created jar before chain re-fetch completes
  const addJar = useCallback((jar: JarAccount) => {
    if (publicKey) saveKnownPubkey(publicKey.toBase58(), jar.pubkey);
    setExtraJars(prev => prev.some(j => j.pubkey === jar.pubkey) ? prev : [...prev, jar]);
    // Also kick off a background refresh
    setTick(t => t + 1);
  }, [publicKey]);

  return { jars, loading, error, refresh, addJar };
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

    setLoading(true);

    fetchContributions(connection, new PublicKey(jarPubkey), wallet.adapter as never)
      .then(setContributions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [jarPubkey, connection, wallet]);

  return { contributions, loading };
}
