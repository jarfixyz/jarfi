"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { fetchJarByPubkey, fetchContributions } from "./program";
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
  // Use only publicKey (stable) — NOT wallet object (recreated every render)
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [chainJars, setChainJars] = useState<JarAccount[]>([]);
  const [extraJars, setExtraJars] = useState<JarAccount[]>([]);
  const [loading, setLoading]     = useState(false);
  const [tick, setTick]           = useState(0);
  const lastOwnerRef              = useRef<string | null>(null);

  useEffect(() => {
    // Do NOT clear jars when publicKey is temporarily null (autoConnect in progress).
    if (!publicKey) return;

    const owner = publicKey.toBase58();
    const abortCtrl = new AbortController();

    // Clear jars ONLY when switching to a different wallet address.
    if (lastOwnerRef.current !== null && lastOwnerRef.current !== owner) {
      setChainJars([]);
      setExtraJars([]);
    }
    lastOwnerRef.current = owner;

    setLoading(true);

    // Load jars from localStorage-known pubkeys via individual getAccountInfo calls.
    // We intentionally avoid getProgramAccounts — Helius devnet blocks it consistently.
    const known = loadKnownPubkeys(owner);
    if (known.length === 0) {
      setLoading(false);
      return;
    }

    Promise.all(
      known.map(pk => fetchJarByPubkey(connection, new PublicKey(pk)).catch(() => null))
    ).then(fetched => {
      if (abortCtrl.signal.aborted) return;
      const valid = fetched.filter(Boolean) as JarAccount[];
      setChainJars(valid);
    }).catch((err) => {
      if (!abortCtrl.signal.aborted) console.warn("[useJars] fetch failed:", err?.message ?? err);
    }).finally(() => {
      if (!abortCtrl.signal.aborted) setLoading(false);
    });

    return () => { abortCtrl.abort(); };
  }, [publicKey, connection, tick]);

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
  const { connection } = useConnection();
  const [contributions, setContributions] = useState<ContributionAccount[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!jarPubkey) { setContributions([]); return; }
    const abortCtrl = new AbortController();
    setLoading(true);
    fetchContributions(connection, new PublicKey(jarPubkey))
      .then(data => { if (!abortCtrl.signal.aborted) setContributions(data); })
      .catch(err => { if (!abortCtrl.signal.aborted) console.warn("[useContributions]", err?.message); })
      .finally(() => { if (!abortCtrl.signal.aborted) setLoading(false); });
    return () => { abortCtrl.abort(); };
  }, [jarPubkey, connection]);

  return { contributions, loading };
}
