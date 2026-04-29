"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Lock, Heart, Shield } from "lucide-react";
import TransakWidget from "@/components/TransakWidget";

export type DisplayJar = {
  name: string;
  emoji: string;
  amountCents: number;
  goalCents: number;
  unlockLabel: string;
  contributors: number;
};

// Demo jars — real on-chain accounts on devnet
const SLUG_TO_PUBKEY: Record<string, string> = {
  anya:  "FeAzYeZuvo6eaPcsVp1Yguegcp2AhwwPWTfPV5Z4B9hC",
  japan: "ExvN6nxRbWpqQJrpG6shY9tbcWTtHKEaJDmFVebxFqu4",
  moto:  "28teBgT2U1y25ARUkgGfHjeyBHhnJXorVtLs6Qk93ppc",
};

const SLUG_META: Record<string, { name: string; emoji: string }> = {
  anya:  { name: "Anya's Future", emoji: "👧" },
  japan: { name: "Japan Trip",    emoji: "✈️" },
  moto:  { name: "Motorcycle Fund", emoji: "🏍️" },
};

const IS_SOLANA_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001";
const FALLBACK_APY = 6.85;

export default function GiftClient({ slug }: { slug: string }) {
  const resolvedSlug = SLUG_TO_PUBKEY[slug] ?? slug;
  const isRealJar = IS_SOLANA_PUBKEY.test(resolvedSlug);

  const [jar, setJar] = useState<DisplayJar | null>(null);
  const [jarNotFound, setJarNotFound] = useState(false);
  const [apy, setApy] = useState<number>(FALLBACK_APY);
  const [amount, setAmount] = useState<number>(50);
  const [message, setMessage] = useState("");
  const [showTransak, setShowTransak] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Fetch live APY from Marinade
    fetch("https://api.marinade.finance/msol/apy/1y")
      .then((r) => r.json())
      .then((d: { value?: number }) => {
        const pct = (d.value ?? 0) * 100;
        if (pct > 0) setApy(Math.round(pct * 10) / 10);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isRealJar) { setJarNotFound(true); return; }

    const timeout = setTimeout(() => setJarNotFound(true), 6000);

    fetch(`${BACKEND_URL}/jar/${resolvedSlug}`)
      .then((r) => r.json())
      .then((data: {
        ok: boolean;
        jar?: { mode: number; unlockDate: number; goalAmount: number; balance: number; usdcBalance?: number | null; name?: string | null; emoji?: string | null };
        contributions?: unknown[];
      }) => {
        if (!data.ok || !data.jar) return;
        const j = data.jar;
        const date = j.unlockDate
          ? new Date(j.unlockDate * 1000).toLocaleDateString("en-US", {
              month: "long", day: "numeric", year: "numeric",
            })
          : null;
        const goalUsd = (j.goalAmount / 1_000_000).toLocaleString();
        let unlockLabel = "";
        if (j.mode === 0) unlockLabel = date ? `Opens ${date}` : "Locked";
        else if (j.mode === 1) unlockLabel = `Opens when $${goalUsd} collected`;
        else unlockLabel = `Opens at $${goalUsd}${date ? ` or on ${date}` : ""}`;

        const slugMeta = SLUG_META[slug];
        // USDC: micro-units (6 dec) → cents (/10_000). SOL: lamports (9 dec) → cents (/10_000_000).
        const rawBalance = j.usdcBalance ?? j.balance ?? 0;
        const isUsdc = j.usdcBalance != null;
        const divisor = isUsdc ? 10_000 : 10_000_000;
        setJar({
          name: j.name || slugMeta?.name || "Savings Jar",
          emoji: j.emoji || slugMeta?.emoji || "🏺",
          amountCents: Math.round(rawBalance / divisor),
          goalCents: Math.round((j.goalAmount ?? 0) / divisor),
          unlockLabel,
          contributors: data.contributions?.length ?? 0,
        });
        clearTimeout(timeout);
      })
      .catch(() => setJarNotFound(true))
      .finally(() => clearTimeout(timeout));
  }, [resolvedSlug, isRealJar]);

  const vaultAddress = isRealJar ? resolvedSlug : "11111111111111111111111111111111";
  const pct = jar ? Math.min(100, Math.round((jar.amountCents / jar.goalCents) * 100)) : 0;
  const amountUsd = jar ? (jar.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 }) : "—";
  const goalUsd = jar ? (jar.goalCents / 100).toLocaleString() : "—";

  if (done && jar) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-mint via-white to-surface-lavender px-6">
        <div className="max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl">
          <div className="mb-4 text-6xl">💝</div>
          <h1 className="font-display text-3xl font-semibold">Thank you.</h1>
          <p className="mt-3 text-ink-muted">
            Your ${amount} contribution to <strong>{jar.name}</strong> is on its
            way. You&apos;ll receive a receipt by email.
          </p>
          {message && (
            <div className="mt-6 rounded-2xl bg-surface-cream p-4 text-sm italic text-ink">
              &ldquo;{message}&rdquo;
            </div>
          )}
          <Link href="/" className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-white">
            Learn about JAR
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-surface-lavender via-white to-surface-mint px-6 py-12">
      {showTransak && (
        <TransakWidget
          vaultAddress={vaultAddress}
          fiatAmount={amount}
          contributorMessage={message}
          onSuccess={() => { setShowTransak(false); setDone(true); }}
          onClose={() => setShowTransak(false)}
        />
      )}

      <div className="mx-auto max-w-lg">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink">
          <span className="text-lg">🏺</span>
          <span className="font-display text-xl font-bold">JAR</span>
        </Link>

        <div className="rounded-3xl bg-white p-8 shadow-[0_30px_80px_-30px_rgba(153,69,255,0.3)]">
          {jarNotFound ? (
            <div className="flex h-64 flex-col items-center justify-center text-center">
              <div className="mb-2 text-4xl">🔍</div>
              <div className="font-display text-lg font-semibold">Jar not found</div>
              <div className="mt-1 text-sm text-ink-muted">Check the link and try again</div>
            </div>
          ) : !jar ? (
            <div className="flex h-64 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-sol-purple border-t-transparent" />
            </div>
          ) : (
            <>
              <div className="text-center">
                <div className="text-6xl">{jar.emoji}</div>
                <div className="mt-4 font-display text-3xl font-semibold">{jar.name}</div>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-lavender px-3 py-1 text-xs font-medium text-sol-purple">
                  <Lock className="h-3 w-3" /> {jar.unlockLabel}
                </div>
              </div>

              <div className="mt-8">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-display text-3xl font-semibold">${amountUsd}</span>
                  <span className="text-sm text-ink-muted">of ${goalUsd}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sol-purple via-sol-blue to-sol-green transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-ink-muted">
                  {pct}%{jar.contributors > 0 ? ` · ${jar.contributors} contributors so far` : ""}
                </div>
              </div>

              <div className="my-8 border-t border-black/5" />

              <label className="text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Your contribution
              </label>
              <div className="mt-2 flex items-center rounded-2xl border-2 border-black/10 bg-[#FAFAF8] px-4 transition focus-within:border-sol-purple">
                <span className="font-display text-2xl text-ink-muted">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value) || 0)}
                  className="w-full bg-transparent py-3 pl-2 font-display text-3xl font-semibold outline-none"
                  placeholder="50"
                  min={15}
                />
              </div>

              <div className="mt-3 flex gap-2">
                {[20, 50, 100, 200].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className={`flex-1 rounded-full border py-2 text-sm font-medium transition ${
                      amount === v
                        ? "border-sol-purple bg-surface-lavender text-sol-purple"
                        : "border-black/10 hover:border-black/20"
                    }`}
                  >
                    ${v}
                  </button>
                ))}
              </div>

              <label className="mt-6 block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Message (optional)
              </label>
              <input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="With love from Grandma 💝"
                maxLength={120}
                className="mt-2 w-full rounded-2xl border-2 border-black/10 bg-[#FAFAF8] px-4 py-3 text-sm outline-none focus:border-sol-purple"
              />

              <button
                onClick={() => setShowTransak(true)}
                disabled={amount < 15}
                className="mt-6 w-full rounded-full bg-ink py-4 font-medium text-white transition hover:bg-ink/90 disabled:opacity-40"
              >
                Pay ${amount || 0} by card
              </button>
              <div className="mt-3 text-center text-[11px] text-ink-faint">
                Secure payment · min $15 · no account needed
              </div>
            </>
          )}
        </div>

        <div className="mt-6 space-y-2.5 rounded-3xl bg-white/60 p-5 text-xs text-ink-muted backdrop-blur">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-faint" />
            <span>Your contribution goes directly to an on-chain vault. JAR never holds your money.</span>
          </div>
          <div className="flex items-start gap-2">
            <Heart className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-faint" />
            <span>Funds earn ~{apy}% APY via Marinade staking until the jar unlocks.</span>
          </div>
        </div>
      </div>
    </main>
  );
}
