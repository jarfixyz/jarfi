"use client";

import { useState } from "react";
import Link from "next/link";
import {
  LayoutGrid,
  Package,
  BarChart3,
  Users,
  Send,
  Plus,
  Lock,
  TrendingUp,
  Copy,
  ArrowUpRight,
  X,
  Loader2,
} from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { useJars } from "@/lib/use-jars";
import { createJarOnChain } from "@/lib/create-jar";

// ---------------------------------------------------------------------------
// Mock data — will be replaced with on-chain reads in Stage 2
// ---------------------------------------------------------------------------

type JarType = {
  id: string;
  emoji: string;
  name: string;
  description: string;
  amount: number;
  goal: number;
  locked: boolean;
  unlockLabel: string;
};

const JARS: JarType[] = [
  {
    id: "anya",
    emoji: "👧",
    name: "Anya's Future",
    description: "Unlocks March 2036",
    amount: 847.3,
    goal: 2000,
    locked: true,
    unlockLabel: "by date",
  },
  {
    id: "japan",
    emoji: "✈️",
    name: "Japan Trip",
    description: "4 contributors · June 2026",
    amount: 340,
    goal: 1000,
    locked: false,
    unlockLabel: "by goal",
  },
  {
    id: "moto",
    emoji: "🏍️",
    name: "Motorcycle Fund",
    description: "$5,000 or 6 months",
    amount: 1200,
    goal: 5000,
    locked: false,
    unlockLabel: "goal or date",
  },
];

const ACTIVITY = [
  { icon: "💝", tone: "green", title: "Grandma contributed", sub: "Anya's Future · \"With love\" · 2h ago", amount: "+$50" },
  { icon: "📈", tone: "blue", title: "Staking reward", sub: "All jars · Marinade · Today", amount: "+$3.10" },
  { icon: "💝", tone: "green", title: "Grandpa contributed", sub: "Anya's Future · \"Ice cream\" · Apr 9", amount: "+$30" },
  { icon: "💳", tone: "purple", title: "Your deposit", sub: "Motorcycle Fund · Apr 8", amount: "+$200" },
  { icon: "📈", tone: "blue", title: "Staking reward", sub: "All jars · Apr 4", amount: "+$2.90" },
];

const CONTRIBUTORS = [
  { name: "Grandma Lyuda", comment: "💝 With love, always", amount: "+$180", gradient: "from-sol-purple to-sol-blue" },
  { name: "Grandpa Mykhailo", comment: "🍦 For ice cream", amount: "+$150", gradient: "from-sol-green to-sol-blue" },
  { name: "Aunt Tanya", comment: "🎂 Happy birthday!", amount: "+$70", gradient: "from-orange-400 to-yellow-400" },
  { name: "Uncle Vasyl", comment: "📚 Study hard", amount: "+$36", gradient: "from-red-400 to-orange-400" },
];

// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [activePage, setActivePage] = useState<
    "dashboard" | "jars" | "analytics" | "contributors" | "gift"
  >("dashboard");
  const [modal, setModal] = useState<"new-jar" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [scenario, setScenario] = useState("$50/mo");

  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const { jars: liveJars, loading: jarsLoading } = useJars();

  // Normalize on-chain JarAccount → JarType display shape
  const normalizedLive: JarType[] = liveJars.map((j) => {
    const modeLabel = j.mode === 0 ? "by date" : j.mode === 1 ? "by goal" : "goal or date";
    const unlockDate = j.unlockDate > 0
      ? new Date(j.unlockDate * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
      : null;
    return {
      id: j.pubkey,
      emoji: "🏺",
      name: `Jar ${j.pubkey.slice(0, 4)}…${j.pubkey.slice(-4)}`,
      description: unlockDate ? `Unlocks ${unlockDate}` : `${j.balance / 100} deposited`,
      amount: j.balance / 100,
      goal: j.goalAmount > 0 ? j.goalAmount / 100 : 1000,
      locked: !j.unlocked,
      unlockLabel: modeLabel,
    };
  });

  // Fall back to mock data when wallet not connected (demo mode)
  const jars = normalizedLive.length > 0 ? normalizedLive : JARS;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAF8]">
      {/* ─────────────────────────────────────────────────────────── SIDEBAR */}
      <aside className="flex w-60 flex-shrink-0 flex-col border-r border-black/5 bg-white py-8">
        <Link href="/" className="mb-8 flex items-center gap-2 px-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sol-purple to-sol-blue text-lg">
            🏺
          </div>
          <span className="font-display text-2xl font-bold">JAR</span>
        </Link>

        <div className="px-3">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
            Overview
          </div>
          <NavItem
            label="Dashboard"
            icon={<LayoutGrid className="h-4 w-4" />}
            active={activePage === "dashboard"}
            onClick={() => setActivePage("dashboard")}
          />
          <NavItem
            label="My Jars"
            icon={<Package className="h-4 w-4" />}
            active={activePage === "jars"}
            onClick={() => setActivePage("jars")}
          />
          <NavItem
            label="Analytics"
            icon={<BarChart3 className="h-4 w-4" />}
            active={activePage === "analytics"}
            onClick={() => setActivePage("analytics")}
          />
        </div>

        <div className="mt-6 px-3">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
            Anya&apos;s Jar
          </div>
          <NavItem
            label="Contributors"
            icon={<Users className="h-4 w-4" />}
            active={activePage === "contributors"}
            onClick={() => setActivePage("contributors")}
          />
          <NavItem
            label="Gift Link"
            icon={<Send className="h-4 w-4" />}
            active={activePage === "gift"}
            onClick={() => setActivePage("gift")}
          />
        </div>

        <div className="mt-auto border-t border-black/5 px-3 pt-4">
          <WalletButton />
          {jarsLoading && (
            <div className="mt-2 flex items-center gap-2 px-3 text-[11px] text-ink-faint">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading jars…
            </div>
          )}
        </div>
      </aside>

      {/* ──────────────────────────────────────────────────────────────── MAIN */}
      <main className="flex-1 overflow-y-auto">
        {activePage === "dashboard" && (
          <DashboardPage onNewJar={() => setModal("new-jar")} scenario={scenario} setScenario={setScenario} jars={jars} />
        )}
        {activePage === "jars" && <JarsPage onNewJar={() => setModal("new-jar")} jars={jars} />}
        {activePage === "analytics" && <AnalyticsPage />}
        {activePage === "contributors" && <ContributorsPage />}
        {activePage === "gift" && <GiftPage onCopy={() => showToast("Link copied 📋")} />}
      </main>

      {/* ───────────────────────────────────────────────────────── NEW JAR MODAL */}
      {modal === "new-jar" && (
        <NewJarModal
          onClose={() => setModal(null)}
          onCreate={async (params) => {
            try {
              if (!wallet?.adapter || !publicKey) {
                showToast("Connect wallet first");
                return;
              }
              const childWallet = publicKey.toBase58();
              await createJarOnChain(wallet.adapter as never, connection, { ...params, childWallet });
              setModal(null);
              showToast("Jar created 🏺");
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Unknown error";
              showToast("Failed: " + msg.slice(0, 60));
            }
          }}
        />
      )}

      {/* ────────────────────────────────────────────────────────────── TOAST */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DASHBOARD PAGE
// ---------------------------------------------------------------------------

function DashboardPage({
  onNewJar,
  scenario,
  setScenario,
  jars,
}: {
  onNewJar: () => void;
  scenario: string;
  setScenario: (s: string) => void;
  jars: typeof JARS;
}) {
  return (
    <>
      <TopBar title="Dashboard" subtitle="Good morning, Ivan ☀️">
        <button
          onClick={onNewJar}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition hover:bg-ink/90"
        >
          <Plus className="h-4 w-4" /> New Jar
        </button>
      </TopBar>

      <div className="px-8 py-7">
        {/* Stats */}
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard
            label="Total Saved"
            value="$2,387.30"
            change="↑ +$147.30 this month"
            tint="bg-surface-lavender"
          />
          <StatCard
            label="Staking Earned"
            value="$84.20"
            change="↑ +$3.10 this week"
            tint="bg-surface-mint"
          />
          <StatCard
            label="Active Jars"
            value="3"
            change="1 locked · 2 open"
            tint="bg-surface-sky"
          />
          <StatCard
            label="Contributors"
            value="5"
            change="↑ Grandma sent $50 today"
            tint="bg-surface-cream"
          />
        </div>

        {/* Chart + Forecast */}
        <div className="mb-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
          <Card
            title="Balance Growth · Anya's Jar"
            action={
              <span className="rounded-full bg-sol-purple/10 px-3 py-1 text-[11px] font-semibold text-sol-purple">
                + Staking
              </span>
            }
          >
            <BalanceChart />
          </Card>

          <Card title="Forecast">
            <div className="mb-4 text-xs text-ink-muted">
              Marinade · 6.2% APY · until 2036
            </div>
            <div className="space-y-2">
              {[
                { label: "$50/mo", value: "$11,200", dot: "#14F195" },
                { label: "$100/mo", value: "$21,800", dot: "#9945FF" },
                { label: "$200/mo", value: "$43,100", dot: "#00C2FF" },
              ].map((s) => (
                <button
                  key={s.label}
                  onClick={() => setScenario(s.label)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition ${
                    scenario === s.label
                      ? "border-sol-purple bg-surface-lavender"
                      : "border-black/5 hover:border-black/10"
                  }`}
                >
                  <div
                    className="h-2 w-2 flex-shrink-0 rounded-full"
                    style={{ background: s.dot }}
                  />
                  <span className="flex-1 text-left text-sm">{s.label}</span>
                  <span className="font-display text-base font-semibold">
                    {s.value}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-[#FAFAF8] p-3 text-xs text-ink-muted">
              🔒 Locked until <strong className="text-ink">Mar 15, 2036</strong> · 11 years
            </div>
          </Card>
        </div>

        {/* Jars grid */}
        <Card title="My Jars" action={<CardAction label="View all →" />}>
          <div className="grid gap-3 md:grid-cols-3">
            {jars.map((j) => (
              <JarCard key={j.id} jar={j} />
            ))}
          </div>
        </Card>

        {/* Activity + Contributors */}
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card title="Recent Activity" action={<CardAction label="All →" />}>
            <div className="space-y-1">
              {ACTIVITY.map((a, i) => (
                <ActivityRow key={i} {...a} />
              ))}
            </div>
          </Card>

          <Card
            title="Contributors · Anya's"
            action={<CardAction label="See all →" />}
          >
            <div className="mb-3 text-xs text-ink-muted">
              Family total: <strong className="text-ink">$436</strong>
            </div>
            <div className="space-y-3">
              {CONTRIBUTORS.slice(0, 4).map((c, i) => (
                <ContributorRow key={i} {...c} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-[#FAFAF8] px-4 py-2.5">
              <span className="font-mono text-xs text-ink-muted">
                jarfi.xyz/gift/anya
              </span>
              <button className="rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium">
                Copy
              </button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// JARS / ANALYTICS / CONTRIBUTORS / GIFT — lighter pages
// ---------------------------------------------------------------------------

function JarsPage({ onNewJar, jars }: { onNewJar: () => void; jars: typeof JARS }) {
  return (
    <>
      <TopBar title="My Jars" subtitle={`${jars.length} active`}>
        <button
          onClick={onNewJar}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> New Jar
        </button>
      </TopBar>
      <div className="px-8 py-7">
        <div className="grid gap-4 md:grid-cols-3">
          {jars.map((j) => (
            <JarCard key={j.id} jar={j} />
          ))}
          <button
            onClick={onNewJar}
            className="flex min-h-[200px] items-center justify-center rounded-2xl border-2 border-dashed border-black/10 bg-white/50 text-ink-faint transition hover:border-sol-purple hover:text-sol-purple"
          >
            <div className="text-center">
              <div className="text-4xl font-light">+</div>
              <div className="text-sm font-medium">New Jar</div>
            </div>
          </button>
        </div>
      </div>
    </>
  );
}

function AnalyticsPage() {
  return (
    <>
      <TopBar title="Analytics" subtitle="Full history across all jars" />
      <div className="px-8 py-7">
        <div className="mb-6 grid gap-4 md:grid-cols-4">
          <StatCard label="Total deposited" value="$1,200.30" change="by you" tint="bg-surface-lavender" />
          <StatCard label="Staking earned" value="$84.20" change="↑ 6.2% APY avg" tint="bg-surface-mint" />
          <StatCard label="Family contributed" value="$436.00" change="5 contributors" tint="bg-surface-sky" />
          <StatCard label="Deposits count" value="24" change="across all jars" tint="bg-surface-cream" />
        </div>
        <Card title="All transactions">
          <div className="space-y-1">
            {ACTIVITY.map((a, i) => (
              <ActivityRow key={i} {...a} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function ContributorsPage() {
  return (
    <>
      <TopBar title="Contributors" subtitle="5 contributors · $436 total" />
      <div className="px-8 py-7">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="All contributors">
            <div className="space-y-4">
              {CONTRIBUTORS.map((c, i) => (
                <ContributorRow key={i} {...c} large />
              ))}
            </div>
          </Card>
          <Card title="Breakdown">
            <div className="space-y-4 pt-1">
              {[
                { name: "Grandma Lyuda", pct: 41, gradient: "from-sol-purple to-sol-blue" },
                { name: "Grandpa Mykhailo", pct: 34, gradient: "from-sol-green to-sol-blue" },
                { name: "Aunt Tanya", pct: 16, gradient: "from-orange-400 to-yellow-400" },
                { name: "Uncle Vasyl", pct: 9, gradient: "from-red-400 to-orange-400" },
              ].map((r) => (
                <div key={r.name}>
                  <div className="mb-1.5 flex justify-between text-sm">
                    <span>{r.name}</span>
                    <span className="font-semibold">{r.pct}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                    <div
                      className={`h-full rounded-full bg-gradient-to-r ${r.gradient}`}
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function GiftPage({ onCopy }: { onCopy: () => void }) {
  return (
    <>
      <TopBar title="Gift Link" subtitle="Share with family — no crypto needed" />
      <div className="px-8 py-7">
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Your gift link">
            <p className="mb-5 text-sm text-ink-muted">
              Anyone opens this link and contributes with a regular card — no
              wallet, no registration.
            </p>
            <div className="rounded-2xl bg-gradient-to-br from-surface-lavender via-white to-surface-mint p-7 text-center">
              <div className="mb-2 text-5xl">🏺</div>
              <div className="font-display text-xl font-semibold">Anya&apos;s Future</div>
              <div className="mt-1 text-xs text-ink-muted">
                $847 saved · 11 years to goal
              </div>
              <div className="mt-3 font-mono text-sm font-semibold text-sol-purple">
                jarfi.xyz/gift/anya
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={onCopy}
                className="flex-1 rounded-full bg-ink px-4 py-3 text-sm font-medium text-white"
              >
                <Copy className="mr-2 inline h-4 w-4" /> Copy Link
              </button>
              <button className="flex-1 rounded-full border border-black/10 bg-white px-4 py-3 text-sm font-medium">
                Download QR
              </button>
            </div>
          </Card>

          <Card title="Preview — what family sees">
            <div className="rounded-2xl border border-black/5 bg-[#FAFAF8] p-6">
              <div className="font-display text-2xl font-semibold">🏺 Anya&apos;s Future</div>
              <div className="mt-1 text-xs text-ink-muted">11 years until unlock</div>
              <div className="mt-4 mb-2 flex justify-between text-sm">
                <span>$847 saved</span>
                <span>Goal: $2,000</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-black/5">
                <div className="h-full rounded-full bg-gradient-to-r from-sol-purple to-sol-blue" style={{ width: "42%" }} />
              </div>
              <label className="mt-5 block text-xs font-medium text-ink-muted">
                Amount ($)
              </label>
              <input
                type="number"
                placeholder="50"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
              />
              <label className="mt-3 block text-xs font-medium text-ink-muted">
                Message
              </label>
              <input
                type="text"
                placeholder="With love from grandma 💝"
                className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
              />
              <button className="mt-5 w-full rounded-full bg-ink py-3 text-sm font-medium text-white">
                Pay by card
              </button>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CHART — inline SVG balance growth (purple actual, green baseline)
// ---------------------------------------------------------------------------

function BalanceChart() {
  return (
    <div className="h-40">
      <svg viewBox="0 0 600 160" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9945FF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#9945FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14F195" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#14F195" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9945FF" />
            <stop offset="100%" stopColor="#00C2FF" />
          </linearGradient>
        </defs>
        <line x1="0" y1="40" x2="600" y2="40" stroke="#E8EAF2" />
        <line x1="0" y1="80" x2="600" y2="80" stroke="#E8EAF2" />
        <line x1="0" y1="120" x2="600" y2="120" stroke="#E8EAF2" />
        <text x="0" y="38" fill="#A0A6C8" fontSize="10">$900</text>
        <text x="0" y="78" fill="#A0A6C8" fontSize="10">$700</text>
        <text x="0" y="118" fill="#A0A6C8" fontSize="10">$500</text>

        <path
          d="M30 110 C80 105 130 100 180 95 C230 90 280 86 330 82 C380 78 430 75 480 70 C510 67 540 64 570 60 L570 155 L30 155Z"
          fill="url(#gG)"
        />
        <path
          d="M30 110 C80 105 130 100 180 95 C230 90 280 86 330 82 C380 78 430 75 480 70 C510 67 540 64 570 60"
          fill="none"
          stroke="#14F195"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.7"
        />
        <path
          d="M30 120 C80 112 130 100 180 88 C230 76 260 70 300 62 C340 54 380 48 420 44 C460 40 510 36 570 30 L570 155 L30 155Z"
          fill="url(#gP)"
        />
        <path
          d="M30 120 C80 112 130 100 180 88 C230 76 260 70 300 62 C340 54 380 48 420 44 C460 40 510 36 570 30"
          fill="none"
          stroke="url(#lG)"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="570" cy="30" r="5" fill="url(#lG)" />

        <text x="30" y="155" fill="#A0A6C8" fontSize="10">Jan</text>
        <text x="260" y="155" fill="#A0A6C8" fontSize="10">Mar</text>
        <text x="530" y="155" fill="#A0A6C8" fontSize="10">Now</text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODAL
// ---------------------------------------------------------------------------

function NewJarModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (params: { mode: number; unlockDate: number; goalAmount: number }) => Promise<void>;
}) {
  const [unlockType, setUnlockType] = useState<"goal" | "date" | "both">("goal");
  const [multisig, setMultisig] = useState(false);
  const [goalInput, setGoalInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-white p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-2xl font-semibold">Create a Jar 🏺</div>
            <div className="mt-1 text-sm text-ink-muted">
              Set a goal, a date, or both. Smart contract unlocks automatically.
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-ink-muted">
            Unlock condition
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "goal", label: "🎯 Goal" },
              { id: "date", label: "📅 Date" },
              { id: "both", label: "🎯 + 📅" },
            ].map((o) => (
              <button
                key={o.id}
                onClick={() => setUnlockType(o.id as typeof unlockType)}
                className={`rounded-xl border-2 py-2.5 text-sm font-medium transition ${
                  unlockType === o.id
                    ? "border-sol-purple bg-surface-lavender"
                    : "border-black/10 hover:border-black/20"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
              Jar name
            </label>
            <input
              placeholder="e.g. Anya's Future, Japan Trip…"
              className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
            />
          </div>

          {unlockType !== "date" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Goal amount ($)
              </label>
              <input
                type="number"
                placeholder="5000"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
              />
            </div>
          )}

          {unlockType !== "goal" && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Unlock date
              </label>
              <input
                type="date"
                value={dateInput}
                onChange={(e) => setDateInput(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
              />
            </div>
          )}

          {unlockType === "both" && (
            <div className="rounded-xl bg-surface-sky p-3 text-xs text-ink-muted">
              Jar unlocks at whichever condition is met first.
            </div>
          )}

          <div>
            <button
              onClick={() => setMultisig(!multisig)}
              className="flex w-full items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left hover:border-black/20"
            >
              <div>
                <div className="text-sm font-medium">Multi-sig (optional)</div>
                <div className="text-xs text-ink-muted">
                  Require co-owners to approve early unlock
                </div>
              </div>
              <div
                className={`h-6 w-10 rounded-full p-0.5 transition ${
                  multisig ? "bg-sol-green" : "bg-black/10"
                }`}
              >
                <div
                  className={`h-5 w-5 rounded-full bg-white transition ${
                    multisig ? "translate-x-4" : ""
                  }`}
                />
              </div>
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={submitting}
            className="flex-1 rounded-full border border-black/10 py-3 text-sm font-medium disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            disabled={submitting}
            onClick={async () => {
              const mode = unlockType === "goal" ? 1 : unlockType === "date" ? 0 : 2;
              const unlockDate = dateInput ? Math.floor(new Date(dateInput).getTime() / 1000) : 0;
              const goalAmount = goalInput ? Math.round(parseFloat(goalInput) * 100) : 0;
              setSubmitting(true);
              await onCreate({ mode, unlockDate, goalAmount });
              setSubmitting(false);
            }}
            className="flex-1 rounded-full bg-ink py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting ? "Creating…" : "Create Jar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// REUSABLE BUILDING BLOCKS
// ---------------------------------------------------------------------------

function TopBar({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white/80 px-8 py-4 backdrop-blur">
      <div>
        <div className="font-display text-xl font-semibold">{title}</div>
        <div className="text-xs text-ink-muted">{subtitle}</div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

function NavItem({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
        active
          ? "bg-surface-lavender text-sol-purple"
          : "text-ink-muted hover:bg-black/5 hover:text-ink"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  change,
  tint,
}: {
  label: string;
  value: string;
  change: string;
  tint: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl ${tint} p-5`}>
      <div className="text-xs font-medium text-ink-muted">{label}</div>
      <div className="mt-2 font-display text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-ink-muted">{change}</div>
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-black/5 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-display text-base font-semibold">{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function CardAction({ label }: { label: string }) {
  return (
    <button className="rounded-full px-3 py-1 text-xs font-medium text-sol-purple hover:bg-surface-lavender">
      {label}
    </button>
  );
}

function JarCard({ jar }: { jar: JarType }) {
  const pct = Math.round((jar.amount / jar.goal) * 100);
  return (
    <div className="cursor-pointer rounded-2xl border border-black/5 bg-[#FAFAF8] p-5 transition hover:-translate-y-0.5 hover:border-sol-purple hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="text-3xl">{jar.emoji}</div>
        <div
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
            jar.locked
              ? "bg-surface-lavender text-sol-purple"
              : "bg-surface-mint text-green-700"
          }`}
        >
          {jar.locked ? "🔒 Locked" : "Open"}
        </div>
      </div>
      <div className="mt-3 font-display text-lg font-semibold">{jar.name}</div>
      <div className="text-xs text-ink-muted">{jar.description}</div>
      <div className="mt-3 font-display text-2xl font-semibold">
        ${jar.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sol-purple to-sol-blue"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
        <span>{pct}% of ${jar.goal.toLocaleString()}</span>
        <span>{jar.unlockLabel}</span>
      </div>
    </div>
  );
}

function ActivityRow({
  icon,
  tone,
  title,
  sub,
  amount,
}: {
  icon: string;
  tone: string;
  title: string;
  sub: string;
  amount: string;
}) {
  const tintMap: Record<string, string> = {
    green: "bg-surface-mint",
    purple: "bg-surface-lavender",
    blue: "bg-surface-sky",
  };
  const positive = amount.startsWith("+");
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-[#FAFAF8]">
      <div
        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-base ${
          tintMap[tone] ?? "bg-surface-lavender"
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{title}</div>
        <div className="truncate text-[11px] text-ink-muted">{sub}</div>
      </div>
      <div
        className={`text-sm font-semibold ${
          positive ? "text-green-600" : "text-red-500"
        }`}
      >
        {amount}
      </div>
    </div>
  );
}

function ContributorRow({
  name,
  comment,
  amount,
  gradient,
  large = false,
}: {
  name: string;
  comment: string;
  amount: string;
  gradient: string;
  large?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-black/5 pb-3 last:border-0 last:pb-0">
      <div
        className={`flex flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${gradient} font-bold text-white ${
          large ? "h-10 w-10 text-base" : "h-8 w-8 text-sm"
        }`}
      >
        {name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="truncate text-[11px] text-ink-muted">{comment}</div>
      </div>
      <div className="text-sm font-semibold text-green-600">{amount}</div>
    </div>
  );
}
