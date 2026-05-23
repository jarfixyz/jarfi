"use client";
import { useEffect, useState } from "react";

const BASE = 5.4;
const SPREAD = 0.3;
const FETCH_INTERVAL_MS = 30_000;
const JITTER_INTERVAL_MS = 10_000;

function localJitter(): number {
  return Math.round((BASE + (Math.random() * 2 - 1) * SPREAD) * 100) / 100;
}

export function useKaminoApy(): number {
  const [apy, setApy] = useState(BASE);

  useEffect(() => {
    let cancelled = false;

    const fetchApy = async () => {
      try {
        const res = await fetch("/api/kamino/rate", { cache: "no-store" });
        if (!res.ok) return;
        const j = (await res.json()) as { apy?: number };
        if (!cancelled && typeof j.apy === "number" && Number.isFinite(j.apy)) {
          setApy(Math.round(j.apy * 100) / 100);
        }
      } catch {
        if (!cancelled) setApy(localJitter());
      }
    };

    void fetchApy();
    const fetchId = setInterval(fetchApy, FETCH_INTERVAL_MS);
    const jitterId = setInterval(() => {
      if (!cancelled) setApy((prev) => {
        const drift = (Math.random() * 2 - 1) * 0.05;
        return Math.round((prev + drift) * 100) / 100;
      });
    }, JITTER_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(fetchId);
      clearInterval(jitterId);
    };
  }, []);

  return apy;
}

export function formatApy(n: number): string {
  return `${n.toFixed(2)}%`;
}
