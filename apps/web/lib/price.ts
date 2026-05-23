"use client";

import useSWR from "swr";

const JUP_ENDPOINT = "https://price.jup.ag/v6/price";

async function fetchPrice(
  ids: string,
): Promise<Record<string, number>> {
  const res = await fetch(`${JUP_ENDPOINT}?ids=${ids}`);
  if (!res.ok) return {};
  const body = (await res.json()) as {
    data: Record<string, { price: number }>;
  };
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(body.data ?? {})) out[k] = v.price;
  return out;
}

export function useAssetUsd(symbol: "SOL" | "USDC"): number | null {
  const { data } = useSWR(
    `price:${symbol}`,
    () => fetchPrice(symbol),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
    },
  );
  return data?.[symbol] ?? null;
}
