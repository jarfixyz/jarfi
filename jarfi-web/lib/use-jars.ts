"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { fetchJarByPubkey } from "./program";
import type { JarAccount } from "./program";
import { fetchContributions } from "./program";
import type { ContributionAccount } from "./program";

export type { JarAccount, ContributionAccount };

// ── localStorage helpers ─────────────────────────────────────────────────────

const LAST_OWNER_KEY = "jar_last_owner";

function pubkeysKey(owner: string) { return `jar_pubkeys_${owner}`; }
function cacheKey(owner: string)   { return `jar_cache_${owner}`; }

function getLastOwner(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_OWNER_KEY);
}

function setLastOwner(owner: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(LAST_OWNER_KEY, owner);
}

function loadKnownPubkeys(owner: string): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(pubkeysKey(owner)) ?? "[]"); } catch { return []; }
}

function saveKnownPubkey(owner: string, pubkey: string) {
  if (typeof window === "undefined") return;
  const existing = loadKnownPubkeys(owner);
  if (!existing.includes(pubkey)) {
    localStorage.setItem(pubkeysKey(owner), JSON.stringify([...existing, pubkey]));
  }
}

function removeKnownPubkey(owner: string, pubkey: string) {
  if (typeof window === "undefined") return;
  const existing = loadKnownPubkeys(owner);
  localStorage.setItem(pubkeysKey(owner), JSON.stringify(existing.filter(p => p !== pubkey)));
}

// Full jar data cache — survives RPC failures and page refreshes
function loadCachedJars(owner: string): JarAccount[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(cacheKey(owner)) ?? "[]"); } catch { return []; }
}

function saveCachedJars(owner: string, jars: JarAccount[]) {
  if (typeof window === "undefined" || jars.length === 0) return;
  localStorage.setItem(cacheKey(owner), JSON.stringify(jars));
}

function removeCachedJar(owner: string, pubkey: string) {
  if (typeof window === "undefined") return;
  const existing = loadCachedJars(owner);
  localStorage.setItem(cacheKey(owner), JSON.stringify(existing.filter(j => j.pubkey !== pubkey)));
}

// ── useJars ──────────────────────────────────────────────────────────────────

export function useJars() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const lastOwnerRef = useRef<string | null>(null);

  // Load last owner's cache immediately — jars visible before wallet connects
  const [jars, setJars] = useState<JarAccount[]>(() => {
    const lastOwner = getLastOwner();
    return lastOwner ? loadCachedJars(lastOwner) : [];
  });
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!publicKey) return;

    const owner = publicKey.toBase58();
    const abortCtrl = new AbortController();

    // Switch wallet — clear display
    if (lastOwnerRef.current !== null && lastOwnerRef.current !== owner) {
      setJars([]);
    }
    lastOwnerRef.current = owner;
    setLastOwner(owner); // remember for next page load

    // Step 1: show cached jar data instantly (no RPC needed)
    const cached = loadCachedJars(owner);
    if (cached.length > 0) setJars(cached);

    // Step 2: refresh from RPC in background — use individual getAccountInfo
    // (avoids getProgramAccounts which Helius devnet blocks)
    const known = loadKnownPubkeys(owner);
    if (known.length === 0) {
      setLoading(false);
      return () => { abortCtrl.abort(); };
    }

    setLoading(true);
    Promise.all(
      known.map(pk => fetchJarByPubkey(connection, new PublicKey(pk)).catch(() => null))
    ).then(fetched => {
      if (abortCtrl.signal.aborted) return;
      const valid = fetched.filter(Boolean) as JarAccount[];
      if (valid.length > 0) {
        setJars(valid);
        saveCachedJars(owner, valid);
      }
      // If all fetches failed: keep showing cached data (already set above)
    }).catch(err => {
      if (!abortCtrl.signal.aborted) console.warn("[useJars] RPC error:", err?.message);
    }).finally(() => {
      if (!abortCtrl.signal.aborted) setLoading(false);
    });

    return () => { abortCtrl.abort(); };
  }, [publicKey, connection, tick]);

  const refresh = useCallback(() => setTick(t => t + 1), []);

  const addJar = useCallback((jar: JarAccount) => {
    if (!publicKey) return;
    const owner = publicKey.toBase58();
    saveKnownPubkey(owner, jar.pubkey);
    setJars(prev => {
      const next = prev.some(j => j.pubkey === jar.pubkey) ? prev : [...prev, jar];
      saveCachedJars(owner, next);
      return next;
    });
    setTick(t => t + 1);
  }, [publicKey]);

  const removeJar = useCallback((pubkey: string) => {
    if (!publicKey) return;
    const owner = publicKey.toBase58();
    removeKnownPubkey(owner, pubkey);
    removeCachedJar(owner, pubkey);
    setJars(prev => prev.filter(j => j.pubkey !== pubkey));
  }, [publicKey]);

  return { jars, loading, addJar, removeJar, refresh };
}

// ── useContributions ─────────────────────────────────────────────────────────

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
