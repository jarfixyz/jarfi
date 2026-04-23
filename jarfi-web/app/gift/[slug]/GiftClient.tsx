"use client";

import { useState } from "react";
import Link from "next/link";
import { Lock, Heart, Shield } from "lucide-react";

// Mock jar store — replace with on-chain read in Stage 2
const MOCK_JARS: Record<
  string,
  {
    name: string;
    emoji: string;
    amount: number;
    goal: number;
    unlockLabel: string;
    unlockType: "goal" | "date" | "both";
    unlockDate?: string;
    contributors: number;
  }
> = {
  anya: {
    name: "Anya's Future",
    emoji: "👧",
    amount: 847.3,
    goal: 2000,
    unlockLabel: "Unlocks on March 15, 2036",
    unlockType: "date",
    unlockDate: "2036-03-15",
    contributors: 5,
  },
  japan: {
    name: "Japan Trip",
    emoji: "✈️",
    amount: 340,
    goal: 1000,
    unlockLabel: "Unlocks when $1,000 collected",
    unlockType: "goal",
    contributors: 4,
  },
  moto: {
    name: "Motorcycle Fund",
    emoji: "🏍️",
    amount: 1200,
    goal: 5000,
    unlockLabel: "Unlocks at $5,000 or in 6 months (whichever comes first)",
    unlockType: "both",
    contributors: 2,
  },
};

export default function GiftClient({ slug }: { slug: string }) {
  const jar = MOCK_JARS[slug] ?? MOCK_JARS.anya;

  const [amount, setAmount] = useState<number>(50);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const pct = Math.min(100, Math.round((jar.amount / jar.goal) * 100));

  const handlePay = async () => {
    setSubmitting(true);
    // Placeholder — in Stage 2 this opens MoonPay widget
    await new Promise((r) => setTimeout(r, 800));
    setSubmitting(false);
    setDone(true);
  };

  if (done) {
    return (
      <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-surface-mint via-white to-surface-lavender px-6">
        <div className="max-w-md rounded-3xl bg-white p-10 text-center shadow-2xl">
          <div className="mb-4 text-6xl">💝</div>
          <h1 className="font-display text-3xl font-semibold">
            Thank you.
          </h1>
          <p className="mt-3 text-ink-muted">
            Your ${amount} contribution to <strong>{jar.name}</strong> is on its
            way. You&apos;ll receive a receipt by email.
          </p>
          {message && (
            <div className="mt-6 rounded-2xl bg-surface-cream p-4 text-sm italic text-ink">
              &ldquo;{message}&rdquo;
            </div>
          )}
          <Link
            href="/"
            className="mt-8 inline-block rounded-full bg-ink px-6 py-3 text-sm font-medium text-white"
          >
            Learn about JAR
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-gradient-to-br from-surface-lavender via-white to-surface-mint px-6 py-12">
      <div className="mx-auto max-w-lg">
        {/* Minimal nav */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-2 text-sm text-ink-muted hover:text-ink"
        >
          <span className="text-lg">🏺</span>
          <span className="font-display text-xl font-bold">JAR</span>
        </Link>

        {/* Jar card */}
        <div className="rounded-3xl bg-white p-8 shadow-[0_30px_80px_-30px_rgba(153,69,255,0.3)]">
          <div className="text-center">
            <div className="text-6xl">{jar.emoji}</div>
            <div className="mt-4 font-display text-3xl font-semibold">
              {jar.name}
            </div>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-surface-lavender px-3 py-1 text-xs font-medium text-sol-purple">
              <Lock className="h-3 w-3" /> {jar.unlockLabel}
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-display text-3xl font-semibold">
                ${jar.amount.toLocaleString(undefined, { minimumFractionDigits: 0 })}
              </span>
              <span className="text-sm text-ink-muted">
                of ${jar.goal.toLocaleString()}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-black/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sol-purple via-sol-blue to-sol-green transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-ink-muted">
              {pct}% · {jar.contributors} contributors so far
            </div>
          </div>

          <div className="my-8 border-t border-black/5" />

          {/* Amount picker */}
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
              min={10}
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

          {/* Message */}
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

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={submitting || amount < 10}
            className="mt-6 w-full rounded-full bg-ink py-4 font-medium text-white transition hover:bg-ink/90 disabled:opacity-40"
          >
            {submitting ? "Processing…" : `Pay $${amount || 0} by card`}
          </button>
          <div className="mt-3 text-center text-[11px] text-ink-faint">
            Powered by MoonPay · min $10 · no registration
          </div>
        </div>

        {/* Trust strip */}
        <div className="mt-6 space-y-2.5 rounded-3xl bg-white/60 p-5 text-xs text-ink-muted backdrop-blur">
          <div className="flex items-start gap-2">
            <Shield className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-faint" />
            <span>
              Your contribution goes directly to an on-chain vault. JAR never
              holds your money.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Heart className="mt-0.5 h-4 w-4 flex-shrink-0 text-ink-faint" />
            <span>
              Funds earn ~6.2% APY via Marinade staking until the jar unlocks.
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
