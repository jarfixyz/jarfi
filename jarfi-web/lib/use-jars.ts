"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { fetchJarsByOwner, fetchJarByPubkey, fetchContributions } from "./program";
import type { JarAccount, ContributionAccount } from "./program";

export type { JarAccount, ContributionAccount };

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

function removeKnownPubkey(owner: string, pubkey: string) {
  if (typeof window === "undefined") return;
  const existing = loadKnownPubkeys(owner);
  localStorage.setItem(knownPubkeysKey(owner), JSON.stringify(existing.filter(p => p !== pubkey)));
}

export function useJars() {
  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const [chainJars, setChainJars] = useState<JarAccount[]>([]);
  const [extraJars, setExtraJars] = useState<JarAccount[]>([]);
  const [loading, setLoading]     = useState(false);
  const [tick, setTick]           = useState(0);
  const lastOwnerRef              = useRef<string | null>(null);

  useEffect(() => {
    // Do NOT clear jars when wallet is temporarily null (autoConnect in progress).
    // Only act when we have a real wallet connection.
    if (!publicKey || !wallet?.adapter) return;

    const owner = publicKey.toBase58();

    // Clear jars ONLY when switching to a different wallet address.
    if (lastOwnerRef.current !== null && lastOwnerRef.current !== owner) {
      setChainJars([]);
      setExtraJars([]);
    }
    lastOwnerRef.current = owner;

    setLoading(true);

    // Step 1: show known jars from localStorage immediately (no RPC wait)
    const known = loadKnownPubkeys(owner);
    if (known.length > 0) {
      Promise.all(
        known.map(pk => fetchJarByPubkey(connection, new PublicKey(pk)).catch(() => null))
      ).then(fetched => {
        const valid = fetched.filter(Boolean) as JarAccount[];
        // Only update if at least one jar fetched — keeps jars visible when RPC is slow
        if (valid.length > 0) setExtraJars(valid);
      });
    }

    // Step 2: bulk-discover via getProgramAccounts (may be blocked by Helius on devnet)
    fetchJarsByOwner(connection, publicKey, wallet.adapter as never)
      .then((jars) => {
        if (jars.length > 0) {
          jars.forEach(j => saveKnownPubkey(owner, j.pubkey));
          setChainJars(jars);
          // Do NOT clear extraJars — useMemo deduplication handles overlap.
          // extraJars buffers newly created jars that the indexer hasn't caught yet.
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [publicKey, connection, wallet, tick]);

  // Chain jars are authoritative; extras fill in what the indexer missed
  const jars = useMemo(() => {
    const chainPks = new Set(chainJars.map(j => j.pubkey));
    return [...chainJars, ...extraJars.filter(j => !chainPks.has(j.pubkey))];
  }, [chainJars, extraJars]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const addJar = useCallback((jar: JarAccount) => {
    if (publicKey) saveKnownPubkey(publicKey.toBase58(), jar.pubkey);
    setExtraJars(prev => prev.some(j => j.pubkey === jar.pubkey) ? prev : [...prev, jar]);
    setTick(t => t + 1);
  }, [publicKey]);

  const removeJar = useCallback((pubkey: string) => {
    if (publicKey) removeKnownPubkey(publicKey.toBase58(), pubkey);
    setChainJars(prev => prev.filter(j => j.pubkey !== pubkey));
    setExtraJars(prev => prev.filter(j => j.pubkey !== pubkey));
  }, [publicKey]);

  return { jars, loading, addJar, removeJar, refresh };
}

export function useContributions(jarPubkey: string | null) {
  const { wallet } = useWallet();
  const { connection } = useConnection();
  const [contributions, setContributions] = useState<ContributionAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jarPubkey || !wallet?.adapter) { setContributions([]); return; }
    setLoading(true);
    fetchContributions(connection, new PublicKey(jarPubkey), wallet.adapter as never)
      .then(setContributions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [jarPubkey, connection, wallet]);

  return { contributions, loading };
}
