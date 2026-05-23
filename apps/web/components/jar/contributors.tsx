"use client";

import useSWR from "swr";
import { shortAddr } from "@/lib/hash-avatar";
import { funName } from "@/lib/fun-name";

interface ContribRow {
  donor: string;
  amount: string;
  firstAt: number;
  lastAt: number;
  refunded: boolean;
  donorName: string | null;
}

const fetcher = async (url: string): Promise<ContribRow[]> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`contributors ${res.status}`);
  return (await res.json()) as ContribRow[];
};

function decimalsFor(asset: "sol" | "usdc"): number {
  return asset === "sol" ? 1_000_000_000 : 1_000_000;
}

function displayName(row: ContribRow): string {
  return row.donorName || funName(row.donor);
}

export function Contributors({
  lookupId,
  asset,
}: {
  lookupId: string;
  asset: "sol" | "usdc";
}) {
  const { data, error, isLoading } = useSWR<ContribRow[]>(
    `/api/jars/${lookupId}/contributors`,
    fetcher,
    { refreshInterval: 30_000, revalidateOnFocus: false },
  );

  const places = asset === "sol" ? 3 : 2;
  const divisor = decimalsFor(asset);
  const label = asset.toUpperCase();

  if (isLoading) {
    return (
      <p
        className="py-6 text-center"
        style={{ color: "var(--h-ink-3)", fontSize: 14 }}
      >
        Loading…
      </p>
    );
  }

  if (error) {
    return (
      <p
        className="py-6 text-center"
        style={{ color: "var(--h-ink-3)", fontSize: 14 }}
      >
        Couldn’t load contributors.
      </p>
    );
  }

  if (!data?.length) {
    return (
      <p
        className="py-6 text-center"
        style={{ color: "var(--h-ink-3)", fontSize: 14 }}
      >
        No contributions yet.
      </p>
    );
  }

  return (
    <ul
      className="divide-y rounded-[12px]"
      style={{
        background: "var(--h-card)",
        border: "0.5px solid var(--h-line)",
        borderColor: "var(--h-line)",
      }}
    >
      {data.map((c) => (
        <li
          key={c.donor}
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderColor: "var(--h-line)" }}
        >
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className="truncate"
              style={{ color: "var(--h-ink)", fontSize: 14, fontWeight: 500 }}
            >
              {displayName(c)}
            </span>
            <span
              className="shrink-0 font-mono"
              style={{ color: "var(--h-ink-3)", fontSize: 11 }}
            >
              {shortAddr(c.donor)}
            </span>
          </div>
          <span
            className="whitespace-nowrap tabular-nums"
            style={{ color: "var(--h-ink)", fontSize: 14, fontWeight: 500 }}
          >
            {(Number(c.amount) / divisor).toFixed(places)}{" "}
            <span style={{ color: "var(--h-ink-3)", fontWeight: 400 }}>
              {label}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
