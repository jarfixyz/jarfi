"use client";

import { LAMPORTS_PER_SOL } from "@solana/web3.js";

export function MarinadeStakeCard({
  principalLamports,
  msolBalanceLamports,
  rate,
}: {
  principalLamports: bigint;
  msolBalanceLamports: bigint | null;
  rate: number | null;
}) {
  if (msolBalanceLamports === null) return null; // ATA not loaded yet
  const msol = Number(msolBalanceLamports) / LAMPORTS_PER_SOL;
  const principal = Number(principalLamports) / LAMPORTS_PER_SOL;
  const solEquiv = rate ? msol * rate : null;
  const yieldSol = solEquiv !== null ? Math.max(0, solEquiv - principal) : null;
  const yieldPct =
    yieldSol !== null && principal > 0 ? (yieldSol / principal) * 100 : null;

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 mt-4">
      <div className="text-sm font-medium text-emerald-900">Staked via Marinade</div>
      <div className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
        <div className="text-emerald-700">mSOL balance</div>
        <div className="text-right tabular-nums">{msol.toFixed(6)} mSOL</div>
        {solEquiv !== null && (
          <>
            <div className="text-emerald-700">≈ SOL value</div>
            <div className="text-right tabular-nums">{solEquiv.toFixed(6)} SOL</div>
          </>
        )}
        {yieldSol !== null && yieldPct !== null && (
          <>
            <div className="text-emerald-700">Yield</div>
            <div className="text-right tabular-nums">
              +{yieldSol.toFixed(6)} SOL (+{yieldPct.toFixed(2)}%)
            </div>
          </>
        )}
      </div>
      {rate === null && (
        <div className="mt-2 text-xs text-emerald-600">
          Live rate unavailable; showing mSOL only.
        </div>
      )}
    </div>
  );
}
