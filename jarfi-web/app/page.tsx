"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Lock,
  TrendingUp,
  Heart,
  Target,
  Calendar,
  Users,
  Sparkles,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Calculator logic — monthly compounding over N years, with optional family bonus
// ---------------------------------------------------------------------------
function compound(monthly: number, years: number, apr: number, familyYearly = 0) {
  const months = years * 12;
  const rate = apr / 12;
  let balance = 0;
  for (let m = 0; m < months; m++) {
    balance = balance * (1 + rate) + monthly;
    if ((m + 1) % 12 === 0) balance += familyYearly; // add family contribution yearly
  }
  return Math.round(balance);
}

// ---------------------------------------------------------------------------

export default function Landing() {
  const [monthly, setMonthly] = useState(50);
  const [years, setYears] = useState(18);
  const [family, setFamily] = useState(200);

  const spent = 0;
  const bank = useMemo(() => compound(monthly, years, 0.005, family), [monthly, years, family]);
  const jar = useMemo(() => compound(monthly, years, 0.062, family), [monthly, years, family]);

  return (
    <main className="relative overflow-x-hidden bg-[#FAFAF8]">
      {/* ──────────────────────────────────────────────────────────────── NAV */}
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6 md:px-10">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sol-purple to-sol-blue text-lg">
            🏺
          </div>
          <span className="font-display text-2xl font-bold tracking-tight">JAR</span>
        </div>
        <div className="hidden items-center gap-8 md:flex">
          <a href="#how" className="text-sm text-ink-muted hover:text-ink">How it works</a>
          <a href="#scenarios" className="text-sm text-ink-muted hover:text-ink">Scenarios</a>
          <a href="#trust" className="text-sm text-ink-muted hover:text-ink">Trust</a>
          <Link
            href="/dashboard"
            className="rounded-full bg-ink px-5 py-2 text-sm font-medium text-white transition hover:bg-ink/90"
          >
            Open app
          </Link>
        </div>
        <Link
          href="/dashboard"
          className="rounded-full bg-ink px-4 py-2 text-sm font-medium text-white md:hidden"
        >
          Open
        </Link>
      </nav>

      {/* ─────────────────────────────────────────────────────────────── HERO */}
      <section className="relative px-6 pb-24 pt-12 md:px-10 md:pt-20">
        <div className="blob-bg h-[420px] w-[420px] left-[-120px] top-[-80px] bg-surface-lavender" />
        <div className="blob-bg h-[340px] w-[340px] right-[-80px] top-[40px] bg-surface-mint" />

        <div className="relative z-10 mx-auto grid max-w-7xl gap-12 md:grid-cols-2 md:items-center">
          <div className="fade-up">
            <span className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs font-medium backdrop-blur">
              <Sparkles className="h-3 w-3" /> Colosseum Frontier 2026 · Built on Solana
            </span>
            <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] tracking-tight md:text-7xl">
              Save together.
              <br />
              <span className="italic text-sol-purple">Lock it.</span>{" "}
              <span className="italic text-sol-green">Grow it.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-ink-muted">
              A savings jar you share with people you love. Set a goal, a date,
              or both. Family contributes by card — no crypto, no registration.
              Funds lock on-chain and earn yield automatically.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 font-medium text-white transition hover:gap-3 hover:bg-ink/90"
              >
                Create your first jar
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#calculator"
                className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-6 py-3.5 font-medium text-ink transition hover:border-black/20"
              >
                See the math
              </a>
            </div>
          </div>

          {/* Hero visual — a floating jar mock */}
          <div className="fade-up relative" style={{ animationDelay: "0.15s" }}>
            <div className="float relative mx-auto aspect-square w-full max-w-md rounded-[40px] bg-gradient-to-br from-surface-lavender via-white to-surface-mint p-8 shadow-[0_40px_80px_-20px_rgba(153,69,255,0.25)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-medium uppercase tracking-[2px] text-ink-faint">
                    Anya&apos;s Future
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                    <Lock className="h-3 w-3" /> Unlocks 2036
                  </div>
                </div>
                <div className="rounded-full bg-sol-green/20 px-3 py-1 text-[11px] font-semibold text-green-700">
                  +6.85% APY
                </div>
              </div>

              <div className="mt-8">
                <div className="font-display text-5xl font-semibold">
                  $1,284<span className="text-ink-faint">.50</span>
                </div>
                <div className="mt-2 text-sm text-ink-muted">42% of $3,000 goal</div>
              </div>

              <div className="mt-4 h-2 overflow-hidden rounded-full bg-black/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sol-purple to-sol-blue"
                  style={{ width: "42%" }}
                />
              </div>

              <div className="mt-8 space-y-3">
                {[
                  { name: "Grandma Lyuda", msg: "With love 💝", amt: "+$50" },
                  { name: "Grandpa Misha", msg: "Ice cream fund 🍦", amt: "+$30" },
                  { name: "Staking reward", msg: "Marinade · weekly", amt: "+$3.10" },
                ].map((r, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between rounded-2xl bg-white/70 px-4 py-3 backdrop-blur"
                  >
                    <div>
                      <div className="text-sm font-medium">{r.name}</div>
                      <div className="text-xs text-ink-muted">{r.msg}</div>
                    </div>
                    <div className="text-sm font-semibold text-green-600">{r.amt}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────── CALCULATOR / THREE PATHS */}
      <section id="calculator" className="relative bg-white px-6 py-24 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface-lavender px-3 py-1 text-xs font-medium text-sol-purple">
              The math
            </div>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Three paths.
              <br />
              <span className="italic text-ink-muted">One is for you.</span>
            </h2>
            <p className="mt-6 text-lg text-ink-muted">
              Move the sliders. See what actually happens over time when money
              sits in a drawer vs. a bank vs. a JAR.
            </p>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
            {/* Sliders */}
            <div className="space-y-8 rounded-3xl border border-black/5 bg-[#FAFAF8] p-8">
              <Slider
                label="Monthly deposit"
                value={monthly}
                min={10}
                max={500}
                step={10}
                onChange={setMonthly}
                format={(v) => `$${v}`}
              />
              <Slider
                label="Years"
                value={years}
                min={1}
                max={25}
                step={1}
                onChange={setYears}
                format={(v) => `${v} ${v === 1 ? "year" : "years"}`}
              />
              <Slider
                label="Family contributions (per year)"
                value={family}
                min={0}
                max={1200}
                step={50}
                onChange={setFamily}
                format={(v) => `$${v}`}
              />

              <div className="border-t border-black/5 pt-6 text-xs text-ink-muted">
                Monthly compounding. Bank APY 0.5% (US avg). JAR uses Marinade
                at ~6.85% APY — variable, not guaranteed.
              </div>
            </div>

            {/* Results */}
            <div className="space-y-4">
              <ResultRow
                emoji="💸"
                label="Spent along the way"
                sub="Birthday money. Holiday envelopes. Groceries, bills, nothing memorable."
                amount={spent}
                tone="neutral"
              />
              <ResultRow
                emoji="🏦"
                label="Traditional bank"
                sub="A savings account at ~0.5% APY. Only you can deposit."
                amount={bank}
                tone="mid"
              />
              <ResultRow
                emoji="🏺"
                label="JAR"
                sub="Auto-staked at ~6.85% APY. Family contributes by card."
                amount={jar}
                tone="win"
                highlight
              />
              <div className="px-2 pt-2 text-sm text-ink-muted">
                Difference:{" "}
                <span className="font-semibold text-ink">
                  ${(jar - bank).toLocaleString()}
                </span>{" "}
                more than a bank. That&apos;s a first apartment deposit vs. a
                weekend trip.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────── UNLOCK TYPES */}
      <section id="how" className="px-6 py-24 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-surface-mint px-3 py-1 text-xs font-medium text-green-700">
              How it unlocks
            </div>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Three ways
              <br />
              to <span className="italic">break a jar.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <UnlockCard
              icon={<Target className="h-6 w-6" />}
              title="By goal"
              example="$5,000"
              description="Set a target. The smart contract watches the balance and unlocks automatically when it's reached."
              tint="bg-surface-lavender"
              accent="text-sol-purple"
            />
            <UnlockCard
              icon={<Calendar className="h-6 w-6" />}
              title="By date"
              example="March 15, 2036"
              description="A child's 18th birthday. Wedding day. Retirement. Lock it until the moment arrives."
              tint="bg-surface-mint"
              accent="text-green-700"
            />
            <UnlockCard
              icon={<div className="flex -space-x-1"><Target className="h-5 w-5" /><Calendar className="h-5 w-5" /></div>}
              title="Either / first"
              example="$5,000 or 6 months"
              description="Whichever comes first. Hit the goal early? It opens. Hit the date? It opens."
              tint="bg-surface-sky"
              accent="text-sol-blue"
            />
          </div>

          <div className="mt-10 rounded-3xl border border-black/5 bg-white p-8">
            <div className="flex items-start gap-4">
              <Users className="mt-1 h-6 w-6 flex-shrink-0 text-ink-muted" />
              <div>
                <div className="font-display text-xl font-semibold">
                  Optional multi-sig on any jar
                </div>
                <p className="mt-2 text-ink-muted">
                  Add co-owners — two parents, a group of friends — and early
                  unlock requires every signature. Contributions always flow in
                  freely. Only unlocking takes coordination.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────── SCENARIOS */}
      <section id="scenarios" className="relative bg-ink px-6 py-24 text-white md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
              Real scenarios
            </div>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              Same product.
              <br />
              <span className="italic text-white/60">Different lives.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Scenario
              emoji="🏍️"
              title="Motorcycle fund"
              kicker="Quick jar · goal or 6 months"
              body="You want a motorcycle. It costs $5,000. Friends chip in for your birthday, you top it up monthly. The day balance hits $5k — unlocks automatically. No waiting for the date."
            />
            <Scenario
              emoji="🎂"
              title="Birthday collection"
              kicker="Quick jar · group"
              body="Friends pool for a gift. $300 goal, date of the party. Everyone pays by card from the group chat link. No Venmo math, no one fronting the money, no follow-ups."
            />
            <Scenario
              emoji="👶"
              title="Newborn jar"
              kicker="Long jar · 18 years"
              body="Parents create a jar on day one. Grandma opens the link and sends $50 by card. Over 18 years, deposits + family + staking compound. On the 18th birthday — one tap, full summary, balance released."
              highlight
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────── THE FLOW */}
      <section className="bg-surface-cream px-6 py-24 md:px-10">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium">
            Contributor flow
          </div>
          <h2 className="font-display text-4xl font-semibold leading-tight md:text-6xl">
            Grandma pays by card.
            <br />
            <span className="italic text-ink-muted">That&apos;s the whole thing.</span>
          </h2>

          <div className="mt-16 grid gap-8 text-left md:grid-cols-3">
            <Step
              n="01"
              title="Open the link"
              body="You text the jar link to grandma. She taps it. Sees a simple page with the jar name, a progress bar, and a number pad."
            />
            <Step
              n="02"
              title="Pay by card"
              body="MoonPay handles the payment. No wallet, no registration, no seed phrase. Amount, a message, her regular debit card."
            />
            <Step
              n="03"
              title="It&apos;s in the jar"
              body="Funds land in the on-chain vault, auto-stake to Marinade, and start earning yield that afternoon. She gets a thank-you receipt."
            />
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────── TRUST */}
      <section id="trust" className="px-6 py-24 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="mb-16 max-w-2xl">
            <h2 className="font-display text-4xl font-semibold leading-tight md:text-6xl">
              Honest about risk.
            </h2>
            <p className="mt-6 text-lg text-ink-muted">
              JAR is not a bank. Deposits are not insured. Here&apos;s exactly
              how it works — no asterisks.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <TrustItem
              icon={<Lock className="h-5 w-5" />}
              title="Your funds, not ours"
              body="Funds go to an on-chain vault controlled by the creator (and co-owners if multi-sig). JAR never holds your money."
            />
            <TrustItem
              icon={<TrendingUp className="h-5 w-5" />}
              title="Yield comes from Marinade"
              body="Variable ~6.85% APY from Solana validator rewards via Marinade liquid staking. Not guaranteed. Fluctuates with the network."
            />
            <TrustItem
              icon={<Heart className="h-5 w-5" />}
              title="Emergency exit, any time"
              body="The creator can withdraw at any moment, bypassing the unlock condition. You&apos;re never stuck."
            />
            <TrustItem
              icon={<Sparkles className="h-5 w-5" />}
              title="Audit in progress"
              body="Smart contract security review underway. JAR runs on Solana mainnet. Use at your own risk — not financial advice."
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────────────────────────── CTA */}
      <section className="px-6 pb-24 md:px-10">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[40px] bg-ink px-8 py-20 text-center md:px-16">
          <div className="blob-bg h-[300px] w-[300px] right-[-60px] top-[-60px] bg-sol-purple opacity-30" />
          <div className="blob-bg h-[260px] w-[260px] left-[-40px] bottom-[-60px] bg-sol-green opacity-20" />

          <h2 className="relative font-display text-4xl font-semibold text-white md:text-6xl">
            Start a jar today.
            <br />
            <span className="italic text-white/60">
              Break it when it&apos;s time.
            </span>
          </h2>
          <p className="relative mx-auto mt-6 max-w-xl text-white/70">
            A time capsule with compound interest. For your child, your trip,
            your motorcycle, or something you haven&apos;t named yet.
          </p>
          <Link
            href="/dashboard"
            className="relative mt-10 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-medium text-ink transition hover:gap-3"
          >
            Open the app <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ──────────────────────────────────────────────────────────────── FOOTER */}
      <footer className="border-t border-black/5 bg-white px-6 py-12 md:px-10">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">🏺</span>
            <span className="font-display text-xl font-semibold">JAR</span>
            <span className="ml-3 text-xs text-ink-muted">
              © 2026 · Colosseum Frontier · jarfi.xyz
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-ink-muted">
            <a href="https://github.com/jarfixyz/jarfi" className="hover:text-ink">
              GitHub
            </a>
            <a href="https://twitter.com/jarfixyz" className="hover:text-ink">
              Twitter
            </a>
            <a href="https://colosseum.com/frontier" className="hover:text-ink">
              Colosseum
            </a>
            <Link href="/dashboard" className="hover:text-ink">
              App
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-8 max-w-7xl text-xs text-ink-faint">
          JAR is a hackathon project. Not financial advice. Smart contract not
          yet audited. Use at your own risk.
        </div>
      </footer>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <label className="text-sm font-medium text-ink-muted">{label}</label>
        <span className="font-display text-2xl font-semibold">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function ResultRow({
  emoji,
  label,
  sub,
  amount,
  tone,
  highlight = false,
}: {
  emoji: string;
  label: string;
  sub: string;
  amount: number;
  tone: "neutral" | "mid" | "win";
  highlight?: boolean;
}) {
  const palette = {
    neutral: "bg-white border-black/5",
    mid: "bg-white border-black/5",
    win: "bg-gradient-to-br from-surface-mint to-white border-sol-green/30",
  }[tone];

  const amountColor = {
    neutral: "text-ink-faint",
    mid: "text-ink",
    win: "text-green-700",
  }[tone];

  return (
    <div
      className={`relative rounded-3xl border p-6 transition ${palette} ${
        highlight ? "shadow-[0_20px_50px_-15px_rgba(20,241,149,0.35)]" : ""
      }`}
    >
      {highlight && (
        <div className="absolute -top-3 right-6 rounded-full bg-sol-green px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink">
          You are here
        </div>
      )}
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <span className="text-3xl">{emoji}</span>
          <div className="min-w-0">
            <div className="font-display text-xl font-semibold">{label}</div>
            <div className="truncate text-xs text-ink-muted">{sub}</div>
          </div>
        </div>
        <div className={`font-display text-3xl font-semibold md:text-4xl ${amountColor}`}>
          ${amount.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function UnlockCard({
  icon,
  title,
  example,
  description,
  tint,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  example: string;
  description: string;
  tint: string;
  accent: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-3xl ${tint} p-8 transition hover:-translate-y-1`}>
      <div className={`mb-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white ${accent}`}>
        {icon}
      </div>
      <div className="font-display text-2xl font-semibold">{title}</div>
      <div className={`mt-1 font-mono text-sm ${accent}`}>{example}</div>
      <p className="mt-4 text-sm text-ink-muted">{description}</p>
    </div>
  );
}

function Scenario({
  emoji,
  title,
  kicker,
  body,
  highlight = false,
}: {
  emoji: string;
  title: string;
  kicker: string;
  body: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-8 transition hover:-translate-y-1 ${
        highlight
          ? "bg-gradient-to-br from-sol-purple/30 to-sol-blue/20"
          : "bg-white/5"
      }`}
    >
      <div className="text-5xl">{emoji}</div>
      <div className="mt-6 text-xs font-medium uppercase tracking-widest text-white/50">
        {kicker}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold">{title}</div>
      <p className="mt-4 text-sm leading-relaxed text-white/70">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div>
      <div className="font-mono text-sm text-ink-faint">{n}</div>
      <div className="mt-2 font-display text-xl font-semibold">{title}</div>
      <p className="mt-3 text-ink-muted">{body}</p>
    </div>
  );
}

function TrustItem({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-black/5 bg-white p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-surface-lavender text-sol-purple">
          {icon}
        </div>
        <div>
          <div className="font-display text-lg font-semibold">{title}</div>
          <p className="mt-2 text-sm text-ink-muted">{body}</p>
        </div>
      </div>
    </div>
  );
}
