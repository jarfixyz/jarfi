"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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
  X,
  Loader2,
  RefreshCw,
  Clock,
  Menu,
} from "lucide-react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { WalletButton } from "@/components/wallet-button";
import { JupiterSwapButton } from "@/components/jupiter-swap";
import { useJars } from "@/lib/use-jars";
import { createJarOnChain, createUsdcJarOnChain } from "@/lib/create-jar";
import { CURRENCY_USDC } from "@/lib/program";
import {
  fetchApy,
  createScheduleApi,
  fetchSchedules,
  stopScheduleApi,
  type Schedule,
  createGroupApi,
  fetchGroupsByOwner,
  type GroupInfo,
  fetchContributionsForJar,
  type JarContribution,
} from "@/lib/api";
import { subscribeToPush } from "@/lib/push";
import TransakWidget from "@/components/TransakWidget";

// ---------------------------------------------------------------------------
// Jar name storage (localStorage) — on-chain jars have no name field
// ---------------------------------------------------------------------------

function getJarName(pubkey: string): string {
  if (typeof window === "undefined") return shortPubkey(pubkey);
  return localStorage.getItem(`jar_name_${pubkey}`) ?? shortPubkey(pubkey);
}

function saveJarName(pubkey: string, name: string) {
  if (typeof window === "undefined") return;
  if (name.trim()) localStorage.setItem(`jar_name_${pubkey}`, name.trim());
}

function shortPubkey(pubkey: string) {
  return `Jar ${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}

// ---------------------------------------------------------------------------
// Forecast helper — monthly compounding
// ---------------------------------------------------------------------------

function calcForecast(
  currentBalance: number,
  monthlyDeposit: number,
  years: number,
  apr: number
): number {
  const months = years * 12;
  const rate = apr / 100 / 12;
  let balance = currentBalance;
  for (let m = 0; m < months; m++) {
    balance = balance * (1 + rate) + monthlyDeposit;
  }
  return Math.round(balance);
}

// ---------------------------------------------------------------------------
// Types
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
  currency: "usdc" | "sol";
  unlockDate: number;
};

// ---------------------------------------------------------------------------
// Dashboard root
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [activePage, setActivePage] = useState<
    "dashboard" | "jars" | "analytics" | "contributors" | "gift"
  >("dashboard");
  const [modal, setModal] = useState<"new-jar" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scenario, setScenario] = useState(50);

  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const { jars: liveJars, loading: jarsLoading } = useJars();
  const [apy, setApy] = useState({ usdc_kamino: 8.2, sol_marinade: 6.85 });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [contributions, setContributions] = useState<JarContribution[]>([]);
  const [confirmBanner, setConfirmBanner] = useState<{
    jar_pubkey: string;
    amount_usdc: number;
  } | null>(null);
  const [showDepositTransak, setShowDepositTransak] = useState(false);

  useEffect(() => {
    fetchApy().then((d) =>
      setApy({ usdc_kamino: d.usdc_kamino, sol_marinade: d.sol_marinade })
    );
  }, []);

  useEffect(() => {
    if (!publicKey) return;
    subscribeToPush(publicKey.toBase58()).catch(() => {});
  }, [publicKey]);

  useEffect(() => {
    if (!publicKey) {
      setSchedules([]);
      setGroups([]);
      return;
    }
    fetchSchedules(publicKey.toBase58()).then(setSchedules);
    fetchGroupsByOwner(publicKey.toBase58()).then(setGroups);
  }, [publicKey]);

  useEffect(() => {
    if (!liveJars.length) {
      setContributions([]);
      return;
    }
    fetchContributionsForJar(liveJars[0].pubkey).then(setContributions);
  }, [liveJars]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const jar_pubkey = p.get("confirm");
    const amount_usdc = Number(p.get("amount") ?? 0);
    if (jar_pubkey) setConfirmBanner({ jar_pubkey, amount_usdc });
  }, []);

  // Close sidebar when navigating
  const navigate = useCallback(
    (page: typeof activePage) => {
      setActivePage(page);
      setSidebarOpen(false);
    },
    []
  );

  // Normalize on-chain JarAccount → JarType
  const normalizedLive: JarType[] = useMemo(
    () =>
      liveJars.map((j) => {
        const isUsdc = j.jarCurrency === CURRENCY_USDC;
        const modeLabel =
          j.mode === 0 ? "by date" : j.mode === 1 ? "by goal" : "goal or date";
        const unlockDate = j.unlockDate;
        const unlockDateStr =
          unlockDate > 0
            ? new Date(unlockDate * 1000).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })
            : null;

        const displayAmount = isUsdc
          ? j.usdcBalance / 1_000_000
          : j.balance / 1_000_000_000;
        const displayGoal = isUsdc
          ? j.goalAmount / 1_000_000
          : j.goalAmount / 1_000_000_000;

        return {
          id: j.pubkey,
          emoji: isUsdc ? "💵" : "◎",
          name: getJarName(j.pubkey),
          description: unlockDateStr
            ? `Unlocks ${unlockDateStr}`
            : `${isUsdc ? "$" : "◎"}${displayAmount.toFixed(2)} deposited`,
          amount: displayAmount,
          goal: displayGoal > 0 ? displayGoal : 1000,
          locked: !j.unlocked,
          unlockLabel: modeLabel,
          currency: isUsdc ? "usdc" : "sol",
          unlockDate,
        };
      }),
    [liveJars]
  );

  const greeting = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : null;

  const firstJarName = normalizedLive[0]?.name ?? null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAF8]">
      {/* ── Mobile overlay ─────────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex w-60 flex-shrink-0 flex-col
          border-r border-black/5 bg-white py-8
          transition-transform duration-200
          md:relative md:translate-x-0
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        <Link
          href="/"
          className="mb-8 flex items-center gap-2 px-6"
          onClick={() => setSidebarOpen(false)}
        >
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
            onClick={() => navigate("dashboard")}
          />
          <NavItem
            label="My Jars"
            icon={<Package className="h-4 w-4" />}
            active={activePage === "jars"}
            onClick={() => navigate("jars")}
          />
          <NavItem
            label="Analytics"
            icon={<BarChart3 className="h-4 w-4" />}
            active={activePage === "analytics"}
            onClick={() => navigate("analytics")}
          />
        </div>

        {(firstJarName || !publicKey) && (
          <div className="mt-6 px-3">
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-ink-faint">
              {firstJarName ?? "Your first jar"}
            </div>
            <NavItem
              label="Contributors"
              icon={<Users className="h-4 w-4" />}
              active={activePage === "contributors"}
              onClick={() => navigate("contributors")}
            />
            <NavItem
              label="Gift Link"
              icon={<Send className="h-4 w-4" />}
              active={activePage === "gift"}
              onClick={() => navigate("gift")}
            />
          </div>
        )}

        {jarsLoading && (
          <div className="mt-4 flex items-center gap-2 px-6 text-[11px] text-ink-faint">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading jars…
          </div>
        )}
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Push confirm banner */}
        {confirmBanner && (
          <div className="sticky top-0 z-20 flex items-center justify-between bg-sol-purple px-6 py-3 text-sm font-medium text-white shadow">
            <span>
              ⏰ Час поповнити банку — $
              {(confirmBanner.amount_usdc / 100).toFixed(2)} → Jar{" "}
              {confirmBanner.jar_pubkey.slice(0, 4)}…
              {confirmBanner.jar_pubkey.slice(-4)}
            </span>
            <div className="ml-4 flex items-center gap-2">
              <button
                onClick={() => setShowDepositTransak(true)}
                className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-sol-purple hover:bg-white/90"
              >
                Поповнити
              </button>
              <button
                onClick={() => setConfirmBanner(null)}
                className="rounded-full p-1 hover:bg-white/20"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {showDepositTransak && confirmBanner && (
          <TransakWidget
            vaultAddress={confirmBanner.jar_pubkey}
            fiatAmount={confirmBanner.amount_usdc / 100}
            contributorMessage="Recurring deposit"
            onSuccess={() => {
              setShowDepositTransak(false);
              setConfirmBanner(null);
              showToast("Депозит підтверджено ✅");
            }}
            onClose={() => setShowDepositTransak(false)}
          />
        )}

        {activePage === "dashboard" && (
          <DashboardPage
            onNewJar={() => setModal("new-jar")}
            scenario={scenario}
            setScenario={setScenario}
            liveJars={normalizedLive}
            greeting={greeting}
            apy={apy}
            schedules={schedules}
            onStopSchedule={async (id) => {
              await stopScheduleApi(id);
              setSchedules((s) => s.filter((x) => x.id !== id));
            }}
            groups={groups}
            contributions={contributions}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
          />
        )}
        {activePage === "jars" && (
          <JarsPage
            onNewJar={() => setModal("new-jar")}
            liveJars={normalizedLive}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
          />
        )}
        {activePage === "analytics" && (
          <AnalyticsPage
            liveJars={normalizedLive}
            contributions={contributions}
            apy={apy}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
          />
        )}
        {activePage === "contributors" && (
          <ContributorsPage
            contributions={contributions}
            liveJars={normalizedLive}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
          />
        )}
        {activePage === "gift" && (
          <GiftPage
            onCopy={() => showToast("Link copied 📋")}
            liveJars={normalizedLive}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
          />
        )}
      </main>

      {/* ── New Jar Modal ──────────────────────────────────────────────────── */}
      {modal === "new-jar" && (
        <NewJarModal
          apy={apy}
          onClose={() => setModal(null)}
          onCreate={async (params) => {
            try {
              if (!wallet?.adapter || !publicKey) {
                showToast("Connect wallet first");
                return;
              }
              const childWallet = publicKey.toBase58();
              let jarPubkey: string;
              if (params.currency === "usdc") {
                ({ jarPubkey } = await createUsdcJarOnChain(
                  wallet.adapter as never,
                  connection,
                  { ...params, childWallet }
                ));
              } else {
                ({ jarPubkey } = await createJarOnChain(
                  wallet.adapter as never,
                  connection,
                  { ...params, childWallet }
                ));
              }
              if (params.jarName) saveJarName(jarPubkey, params.jarName);
              if (params.recurring) {
                await createScheduleApi({
                  jar_pubkey: jarPubkey,
                  owner_pubkey: publicKey.toBase58(),
                  ...params.recurring,
                });
                setSchedules(await fetchSchedules(publicKey.toBase58()));
              }
              if (params.groupTrip) {
                await createGroupApi({
                  jar_pubkey: jarPubkey,
                  owner_pubkey: publicKey.toBase58(),
                  ...params.groupTrip,
                });
                setGroups(await fetchGroupsByOwner(publicKey.toBase58()));
              }
              setModal(null);
              showToast(
                params.groupTrip ? "Групову поїздку створено ✈️" : "Jar created 🏺"
              );
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : "Unknown error";
              showToast("Failed: " + msg.slice(0, 60));
            }
          }}
        />
      )}

      {/* ── Toast ──────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-full bg-ink px-5 py-3 text-sm font-medium text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TopBar — shared header with hamburger for mobile
// ---------------------------------------------------------------------------

function TopBar({
  title,
  subtitle,
  onMenuToggle,
  children,
}: {
  title: string;
  subtitle?: string;
  onMenuToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/5 bg-white/80 px-4 py-4 backdrop-blur md:px-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div>
          <div className="font-display text-lg font-semibold md:text-xl">
            {title}
          </div>
          {subtitle && (
            <div className="text-xs text-ink-muted">{subtitle}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">{children}</div>
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
  liveJars,
  greeting,
  apy,
  schedules,
  onStopSchedule,
  groups,
  contributions,
  onMenuToggle,
}: {
  onNewJar: () => void;
  scenario: number;
  setScenario: (s: number) => void;
  liveJars: JarType[];
  greeting: string | null;
  apy: { usdc_kamino: number; sol_marinade: number };
  schedules: Schedule[];
  onStopSchedule: (id: string) => Promise<void>;
  groups: GroupInfo[];
  contributions: JarContribution[];
  onMenuToggle: () => void;
}) {
  const hasWallet = !!greeting;

  const totalSaved = liveJars.reduce((s, j) => s + j.amount, 0);
  const lockedCount = liveJars.filter((j) => j.locked).length;
  const estimatedYieldMonthly = liveJars.reduce((s, j) => {
    const rate =
      j.currency === "usdc" ? apy.usdc_kamino / 100 : apy.sol_marinade / 100;
    return s + (j.amount * rate) / 12;
  }, 0);
  const uniqueContributors = new Set(contributions.map((c) => c.contributor))
    .size;
  const totalContributed = contributions.reduce(
    (s, c) => s + c.amount / 1_000_000,
    0
  );

  // Forecast: primary jar APY, 18 years remaining
  const primaryApr =
    liveJars[0]?.currency === "sol"
      ? apy.sol_marinade
      : apy.usdc_kamino;
  const yearsRemaining = useMemo(() => {
    const jar = liveJars[0];
    if (!jar || jar.unlockDate <= 0) return 18;
    const remaining = Math.max(
      1,
      Math.ceil((jar.unlockDate - Date.now() / 1000) / (365.25 * 86400))
    );
    return Math.min(remaining, 25);
  }, [liveJars]);

  const forecastScenarios = useMemo(
    () => [
      { label: "$50/mo", monthly: 50 },
      { label: "$100/mo", monthly: 100 },
      { label: "$200/mo", monthly: 200 },
    ].map((s) => ({
      ...s,
      value: calcForecast(totalSaved, s.monthly, yearsRemaining, primaryApr),
    })),
    [totalSaved, yearsRemaining, primaryApr]
  );

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle={greeting ? `Good morning, ${greeting} ☀️` : "Good morning ☀️"}
        onMenuToggle={onMenuToggle}
      >
        <JupiterSwapButton className="hidden items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-black/5 md:inline-flex" />
        <button
          onClick={onNewJar}
          className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New Jar</span>
        </button>
        <WalletButton compact />
      </TopBar>

      <div className="px-4 py-6 md:px-8 md:py-7">
        {/* No wallet — empty state */}
        {!hasWallet && (
          <div className="mb-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/10 bg-white py-16 text-center">
            <div className="mb-3 text-6xl">🏺</div>
            <div className="mb-1 font-display text-xl font-semibold">
              Connect your wallet to start
            </div>
            <div className="mb-6 text-sm text-ink-muted">
              See your jars, track yield, share gift links
            </div>
            <WalletButton />
          </div>
        )}

        {hasWallet && (
          <>
            {/* Stats */}
            <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Total Saved"
                value={`$${totalSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                change={`${liveJars.length} jar${liveJars.length !== 1 ? "s" : ""} · Kamino + Marinade`}
                tint="bg-surface-lavender"
              />
              <StatCard
                label="Staking Earned (est.)"
                value={`~$${estimatedYieldMonthly.toFixed(2)}/mo`}
                change={`Kamino ${apy.usdc_kamino}% · Marinade ${apy.sol_marinade}% APY`}
                tint="bg-surface-mint"
              />
              <StatCard
                label="Active Jars"
                value={String(liveJars.length)}
                change={`${lockedCount} locked · ${liveJars.length - lockedCount} open`}
                tint="bg-surface-sky"
              />
              <StatCard
                label="Contributors"
                value={String(uniqueContributors || contributions.length)}
                change={
                  uniqueContributors > 0
                    ? `$${totalContributed.toFixed(2)} contributed`
                    : "Share your gift link"
                }
                tint="bg-surface-cream"
              />
            </div>

            {/* Chart + Forecast */}
            <div className="mb-5 grid gap-5 lg:grid-cols-[2fr_1fr]">
              <Card
                title={
                  liveJars[0]
                    ? `Balance Growth · ${liveJars[0].name}`
                    : "Balance Growth"
                }
                action={
                  <span className="rounded-full bg-sol-purple/10 px-3 py-1 text-[11px] font-semibold text-sol-purple">
                    + Staking
                  </span>
                }
              >
                <BalanceChart contributions={contributions} />
              </Card>

              <Card title="Forecast">
                <div className="mb-4 text-xs text-ink-muted">
                  {primaryApr.toFixed(1)}% APY · {yearsRemaining}y remaining
                  {totalSaved > 0 && ` · starts at $${totalSaved.toFixed(0)}`}
                </div>
                <div className="space-y-2">
                  {forecastScenarios.map((s) => (
                    <button
                      key={s.label}
                      onClick={() => setScenario(s.monthly)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 transition ${
                        scenario === s.monthly
                          ? "border-sol-purple bg-surface-lavender"
                          : "border-black/5 hover:border-black/10"
                      }`}
                    >
                      <div
                        className="h-2 w-2 flex-shrink-0 rounded-full"
                        style={{
                          background:
                            s.monthly === 50
                              ? "#14F195"
                              : s.monthly === 100
                              ? "#9945FF"
                              : "#00C2FF",
                        }}
                      />
                      <span className="flex-1 text-left text-sm">
                        {s.label}
                      </span>
                      <span className="font-display text-base font-semibold">
                        ${s.value.toLocaleString()}
                      </span>
                    </button>
                  ))}
                </div>
                {liveJars[0] && liveJars[0].unlockDate > 0 && (
                  <div className="mt-4 rounded-xl bg-[#FAFAF8] p-3 text-xs text-ink-muted">
                    🔒 Locked until{" "}
                    <strong className="text-ink">
                      {new Date(liveJars[0].unlockDate * 1000).toLocaleDateString(
                        "en-US",
                        { year: "numeric", month: "short", day: "numeric" }
                      )}
                    </strong>
                  </div>
                )}
              </Card>
            </div>

            {/* Jars grid */}
            <Card title="My Jars" action={<CardAction label="View all →" />}>
              {liveJars.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 text-5xl">🏺</div>
                  <div className="mb-1 font-display text-lg font-semibold">
                    No jars yet
                  </div>
                  <div className="mb-5 text-sm text-ink-muted">
                    Create your first jar and share a gift link
                  </div>
                  <button
                    onClick={onNewJar}
                    className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white hover:bg-ink/90"
                  >
                    <Plus className="h-4 w-4" /> Create your first jar
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                  {liveJars.map((j) => (
                    <JarCard key={j.id} jar={j} />
                  ))}
                </div>
              )}
            </Card>

            {/* Group Trip jars */}
            {groups.length > 0 && (
              <Card
                title="Групові поїздки ✈️"
                action={
                  <button
                    onClick={onNewJar}
                    className="rounded-full px-3 py-1 text-xs font-medium text-sol-purple hover:bg-surface-lavender"
                  >
                    + Нова
                  </button>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups.map((g) => {
                    const daysLeft = Math.max(
                      0,
                      Math.ceil(
                        (g.trip_date * 1000 - Date.now()) / 86_400_000
                      )
                    );
                    return (
                      <a
                        key={g.jar_pubkey}
                        href={`/trip/${g.jar_pubkey}`}
                        className="block rounded-2xl border border-black/5 bg-[#FAFAF8] p-4 transition hover:-translate-y-0.5 hover:border-sol-purple hover:shadow-md"
                      >
                        <div className="flex items-start justify-between">
                          <div className="text-3xl">{g.destination_emoji}</div>
                          <span className="rounded-full bg-surface-sky px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            {daysLeft > 0 ? `${daysLeft} днів` : "Скоро!"}
                          </span>
                        </div>
                        <div className="mt-2 font-display text-base font-semibold">
                          {g.trip_name}
                        </div>
                        <div className="text-xs text-ink-muted">
                          {g.members.length} учасників · $
                          {(g.budget_per_person_cents / 100).toLocaleString()}
                          /особу
                        </div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/5">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-sol-purple to-sol-blue"
                            style={{ width: `${g.total_progress_pct}%` }}
                          />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
                          <span>{g.total_progress_pct}% зібрано</span>
                          <span>Відкрити →</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Recurring schedules */}
            {schedules.length > 0 && (
              <Card
                title="Мої автовнески"
                action={
                  <span className="flex items-center gap-1 rounded-full bg-surface-lavender px-3 py-1 text-[11px] font-semibold text-sol-purple">
                    <RefreshCw className="h-3 w-3" /> {schedules.length}{" "}
                    активних
                  </span>
                }
              >
                <div className="space-y-2">
                  {schedules.map((s) => {
                    const days = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
                    const timeLabel = `${String(s.hour).padStart(2, "0")}:${String(s.minute).padStart(2, "0")}`;
                    const dayLabel =
                      s.frequency === "weekly"
                        ? `кожного ${days[s.day] ?? s.day}`
                        : `кожного ${s.day}-го числа`;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-xl border border-black/5 bg-[#FAFAF8] px-4 py-3"
                      >
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-surface-lavender text-sol-purple">
                          <Clock className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">
                            ${(s.amount_usdc / 100).toFixed(2)} {dayLabel} о{" "}
                            {timeLabel}
                          </div>
                          <div className="truncate text-[11px] text-ink-muted">
                            {getJarName(s.jar_pubkey)}
                          </div>
                        </div>
                        <button
                          onClick={() => onStopSchedule(s.id)}
                          className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-ink-muted hover:border-red-300 hover:text-red-500"
                        >
                          Зупинити
                        </button>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Activity + Contributors */}
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <Card title="Recent Activity" action={<CardAction label="All →" />}>
                {contributions.length === 0 ? (
                  <div className="py-8 text-center text-sm text-ink-muted">
                    Поки немає активності — поділись gift-посиланням 🎁
                  </div>
                ) : (
                  <div className="space-y-1">
                    {[...contributions]
                      .sort((a, b) => b.createdAt - a.createdAt)
                      .slice(0, 6)
                      .map((c) => {
                        const shortAddr = `${c.contributor.slice(0, 4)}…${c.contributor.slice(-4)}`;
                        const ago = (() => {
                          const s = Math.floor(
                            Date.now() / 1000 - c.createdAt
                          );
                          if (s < 3600) return `${Math.floor(s / 60)}хв тому`;
                          if (s < 86400)
                            return `${Math.floor(s / 3600)}г тому`;
                          return `${Math.floor(s / 86400)}д тому`;
                        })();
                        return (
                          <ActivityRow
                            key={c.pubkey}
                            icon="💝"
                            tone="green"
                            title={`${shortAddr} contributed`}
                            sub={`${c.comment ? `"${c.comment.slice(0, 40)}" · ` : ""}${ago}`}
                            amount={`+$${(c.amount / 1_000_000).toFixed(2)}`}
                          />
                        );
                      })}
                  </div>
                )}
              </Card>

              <Card
                title={
                  liveJars[0]
                    ? `Contributors · ${liveJars[0].name}`
                    : "Contributors"
                }
                action={<CardAction label="See all →" />}
              >
                {contributions.length === 0 ? (
                  <div className="py-6 text-center text-sm text-ink-muted">
                    Ще немає внесків
                  </div>
                ) : (
                  <>
                    <div className="mb-3 text-xs text-ink-muted">
                      Всього:{" "}
                      <strong className="text-ink">
                        ${totalContributed.toFixed(2)}
                      </strong>
                    </div>
                    <div className="space-y-3">
                      {contributions.slice(0, 4).map((c, i) => {
                        const gradients = [
                          "from-sol-purple to-sol-blue",
                          "from-sol-green to-sol-blue",
                          "from-orange-400 to-yellow-400",
                          "from-red-400 to-orange-400",
                        ];
                        const short = `${c.contributor.slice(0, 4)}…${c.contributor.slice(-4)}`;
                        return (
                          <ContributorRow
                            key={c.pubkey}
                            name={short}
                            comment={c.comment || "—"}
                            amount={`+$${(c.amount / 1_000_000).toFixed(2)}`}
                            gradient={gradients[i % gradients.length]}
                          />
                        );
                      })}
                    </div>
                  </>
                )}
                {liveJars[0] && (
                  <div className="mt-4 flex items-center justify-between rounded-xl bg-[#FAFAF8] px-4 py-2.5">
                    <span className="truncate font-mono text-xs text-ink-muted">
                      jarfi.xyz/gift/{liveJars[0].id.slice(0, 8)}…
                    </span>
                    <button
                      onClick={() =>
                        navigator.clipboard.writeText(
                          `${window.location.origin}/gift/${liveJars[0].id}`
                        )
                      }
                      className="ml-2 flex-shrink-0 rounded-full border border-black/10 bg-white px-3 py-1 text-xs font-medium"
                    >
                      Copy
                    </button>
                  </div>
                )}
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// JARS PAGE
// ---------------------------------------------------------------------------

function JarsPage({
  onNewJar,
  liveJars,
  onMenuToggle,
}: {
  onNewJar: () => void;
  liveJars: JarType[];
  onMenuToggle: () => void;
}) {
  return (
    <>
      <TopBar
        title="My Jars"
        subtitle={`${liveJars.length} active`}
        onMenuToggle={onMenuToggle}
      >
        <button
          onClick={onNewJar}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" /> New Jar
        </button>
        <WalletButton compact />
      </TopBar>
      <div className="px-4 py-6 md:px-8 md:py-7">
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
          {liveJars.map((j) => (
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

// ---------------------------------------------------------------------------
// ANALYTICS PAGE — real data
// ---------------------------------------------------------------------------

function AnalyticsPage({
  liveJars,
  contributions,
  apy,
  onMenuToggle,
}: {
  liveJars: JarType[];
  contributions: JarContribution[];
  apy: { usdc_kamino: number; sol_marinade: number };
  onMenuToggle: () => void;
}) {
  const totalDeposited = liveJars.reduce((s, j) => s + j.amount, 0);
  const estimatedStaking = liveJars.reduce((s, j) => {
    const rate =
      j.currency === "usdc" ? apy.usdc_kamino / 100 : apy.sol_marinade / 100;
    return s + j.amount * rate;
  }, 0);
  const familyContributed = contributions.reduce(
    (s, c) => s + c.amount / 1_000_000,
    0
  );
  const depositsCount = contributions.length;

  const sortedContribs = [...contributions].sort(
    (a, b) => b.createdAt - a.createdAt
  );

  return (
    <>
      <TopBar
        title="Analytics"
        subtitle="Full history across all jars"
        onMenuToggle={onMenuToggle}
      >
        <WalletButton compact />
      </TopBar>
      <div className="px-4 py-6 md:px-8 md:py-7">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total saved"
            value={`$${totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            change="across all jars"
            tint="bg-surface-lavender"
          />
          <StatCard
            label="Staking earned (est.)"
            value={`~$${estimatedStaking.toFixed(2)}/yr`}
            change={`Kamino ${apy.usdc_kamino}% + Marinade ${apy.sol_marinade}%`}
            tint="bg-surface-mint"
          />
          <StatCard
            label="Family contributed"
            value={`$${familyContributed.toFixed(2)}`}
            change={`${new Set(contributions.map((c) => c.contributor)).size} contributors`}
            tint="bg-surface-sky"
          />
          <StatCard
            label="Total deposits"
            value={String(depositsCount)}
            change="on-chain transactions"
            tint="bg-surface-cream"
          />
        </div>
        <Card title="All transactions">
          {sortedContribs.length === 0 ? (
            <div className="py-8 text-center text-sm text-ink-muted">
              Немає транзакцій. Поділись gift-посиланням 🎁
            </div>
          ) : (
            <div className="space-y-1">
              {sortedContribs.map((c) => {
                const ago = (() => {
                  const s = Math.floor(Date.now() / 1000 - c.createdAt);
                  if (s < 3600) return `${Math.floor(s / 60)}хв тому`;
                  if (s < 86400) return `${Math.floor(s / 3600)}г тому`;
                  return `${Math.floor(s / 86400)}д тому`;
                })();
                return (
                  <ActivityRow
                    key={c.pubkey}
                    icon="💝"
                    tone="green"
                    title={`${c.contributor.slice(0, 4)}…${c.contributor.slice(-4)}`}
                    sub={`${c.comment ? `"${c.comment.slice(0, 50)}" · ` : ""}${ago}`}
                    amount={`+$${(c.amount / 1_000_000).toFixed(2)}`}
                  />
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// CONTRIBUTORS PAGE — real data
// ---------------------------------------------------------------------------

function ContributorsPage({
  contributions,
  liveJars,
  onMenuToggle,
}: {
  contributions: JarContribution[];
  liveJars: JarType[];
  onMenuToggle: () => void;
}) {
  const gradients = [
    "from-sol-purple to-sol-blue",
    "from-sol-green to-sol-blue",
    "from-orange-400 to-yellow-400",
    "from-red-400 to-orange-400",
  ];

  const total = contributions.reduce((s, c) => s + c.amount / 1_000_000, 0);
  const uniqueAddrs = [...new Set(contributions.map((c) => c.contributor))];
  const breakdown = uniqueAddrs.map((addr) => {
    const contributed = contributions
      .filter((c) => c.contributor === addr)
      .reduce((s, c) => s + c.amount / 1_000_000, 0);
    return {
      addr,
      contributed,
      pct: total > 0 ? Math.round((contributed / total) * 100) : 0,
    };
  });

  const jarLabel = liveJars[0]?.name ?? "your jar";

  return (
    <>
      <TopBar
        title="Contributors"
        subtitle={
          contributions.length > 0
            ? `${uniqueAddrs.length} contributors · $${total.toFixed(2)} total`
            : "No contributions yet"
        }
        onMenuToggle={onMenuToggle}
      >
        <WalletButton compact />
      </TopBar>
      <div className="px-4 py-6 md:px-8 md:py-7">
        {contributions.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/10 bg-white py-16 text-center">
            <div className="mb-3 text-5xl">🎁</div>
            <div className="mb-1 font-display text-lg font-semibold">
              No contributions yet
            </div>
            <div className="text-sm text-ink-muted">
              Share your gift link to start collecting
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title={`All contributors · ${jarLabel}`}>
              <div className="space-y-4">
                {contributions.slice(0, 10).map((c, i) => (
                  <ContributorRow
                    key={c.pubkey}
                    name={`${c.contributor.slice(0, 4)}…${c.contributor.slice(-4)}`}
                    comment={c.comment || "—"}
                    amount={`+$${(c.amount / 1_000_000).toFixed(2)}`}
                    gradient={gradients[i % gradients.length]}
                    large
                  />
                ))}
              </div>
            </Card>
            <Card title="Breakdown">
              <div className="space-y-4 pt-1">
                {breakdown.map((r, i) => (
                  <div key={r.addr}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-mono">
                        {r.addr.slice(0, 4)}…{r.addr.slice(-4)}
                      </span>
                      <span className="font-semibold">{r.pct}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/5">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${gradients[i % gradients.length]}`}
                        style={{ width: `${r.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// GIFT PAGE — real jar data
// ---------------------------------------------------------------------------

function GiftPage({
  onCopy,
  liveJars,
  onMenuToggle,
}: {
  onCopy: () => void;
  liveJars: JarType[];
  onMenuToggle: () => void;
}) {
  const firstJar = liveJars[0];
  const giftUrl = firstJar
    ? `${typeof window !== "undefined" ? window.location.origin : "https://jarfi.xyz"}/gift/${firstJar.id}`
    : null;
  const displayUrl = firstJar
    ? `jarfi.xyz/gift/${firstJar.id.slice(0, 8)}…`
    : null;
  const jarName = firstJar?.name ?? "—";
  const jarPct = firstJar
    ? Math.min(100, Math.round((firstJar.amount / firstJar.goal) * 100))
    : 0;

  return (
    <>
      <TopBar
        title="Gift Link"
        subtitle="Share with family — no crypto needed"
        onMenuToggle={onMenuToggle}
      >
        <WalletButton compact />
      </TopBar>
      <div className="px-4 py-6 md:px-8 md:py-7">
        {!firstJar ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-black/10 bg-white py-16 text-center">
            <div className="mb-3 text-5xl">🔗</div>
            <div className="mb-1 font-display text-lg font-semibold">
              No jars yet
            </div>
            <div className="text-sm text-ink-muted">
              Create a jar first to get a gift link
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Your gift link">
              <p className="mb-5 text-sm text-ink-muted">
                Anyone opens this link and contributes with a regular card — no
                wallet, no registration.
              </p>
              <div className="rounded-2xl bg-gradient-to-br from-surface-lavender via-white to-surface-mint p-7 text-center">
                <div className="mb-2 text-5xl">🏺</div>
                <div className="font-display text-xl font-semibold">
                  {jarName}
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  ${firstJar.amount.toFixed(2)} saved · {jarPct}% of goal
                </div>
                <div className="mt-3 font-mono text-sm font-semibold text-sol-purple">
                  {displayUrl}
                </div>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => {
                    if (giftUrl) navigator.clipboard.writeText(giftUrl);
                    onCopy();
                  }}
                  className="w-full rounded-full bg-ink px-4 py-3 text-sm font-medium text-white"
                >
                  <Copy className="mr-2 inline h-4 w-4" /> Copy Link
                </button>
              </div>
            </Card>

            <Card title="Preview — what family sees">
              <div className="rounded-2xl border border-black/5 bg-[#FAFAF8] p-6">
                <div className="font-display text-2xl font-semibold">
                  🏺 {jarName}
                </div>
                <div className="mb-2 mt-4 flex justify-between text-sm">
                  <span>${firstJar.amount.toFixed(2)} saved</span>
                  <span>Goal: ${firstJar.goal.toLocaleString()}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sol-purple to-sol-blue"
                    style={{ width: `${jarPct}%` }}
                  />
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
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// BALANCE CHART — generated from real contributions
// ---------------------------------------------------------------------------

function BalanceChart({ contributions }: { contributions: JarContribution[] }) {
  const points = useMemo(() => {
    if (contributions.length === 0) return null;

    const sorted = [...contributions].sort((a, b) => a.createdAt - b.createdAt);
    let cumulative = 0;
    const data = sorted.map((c) => {
      cumulative += c.amount / 1_000_000;
      return { t: c.createdAt, v: cumulative };
    });

    const minT = data[0].t;
    const maxT = data[data.length - 1].t || minT + 1;
    const maxV = data[data.length - 1].v || 1;

    const W = 540;
    const H = 130;
    const PAD = 30;

    const pts = data.map((d) => ({
      x: PAD + ((d.t - minT) / (maxT - minT || 1)) * (W - PAD * 2),
      y: H - PAD - ((d.v / maxV) * (H - PAD * 2)),
    }));

    const pathD = pts
      .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    const areaD = `${pathD} L${pts[pts.length - 1].x.toFixed(1)} ${H} L${pts[0].x.toFixed(1)} ${H} Z`;

    return { pathD, areaD, maxV, last: pts[pts.length - 1] };
  }, [contributions]);

  if (!points) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-ink-faint">
        No data yet — contributions will appear here
      </div>
    );
  }

  return (
    <div className="h-40">
      <svg viewBox="0 0 540 130" className="h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#9945FF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#9945FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="chartLine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9945FF" />
            <stop offset="100%" stopColor="#00C2FF" />
          </linearGradient>
        </defs>
        <path d={points.areaD} fill="url(#chartFill)" />
        <path
          d={points.pathD}
          fill="none"
          stroke="url(#chartLine)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={points.last.x} cy={points.last.y} r="5" fill="url(#chartLine)" />
        <text x="30" y="125" fill="#A0A6C8" fontSize="10">Start</text>
        <text x="490" y="125" fill="#A0A6C8" fontSize="10">Now</text>
        <text x="30" y="20" fill="#A0A6C8" fontSize="10">
          ${points.maxV.toFixed(0)}
        </text>
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW JAR MODAL
// ---------------------------------------------------------------------------

type GroupTripParams = {
  trip_name: string;
  destination_emoji: string;
  trip_date: number;
  budget_per_person_cents: number;
  owner_nickname: string;
};

type RecurringParams = {
  amount_usdc: number;
  frequency: "weekly" | "monthly";
  day: number;
  hour: number;
  minute: number;
};

function recurLabel(
  amount: string,
  frequency: string,
  day: string,
  time: string
): string {
  const [hh = "09", mm = "00"] = time.split(":");
  const t = `${hh}:${mm}`;
  if (frequency === "weekly") {
    const names = [
      "неділі",
      "понеділка",
      "вівторка",
      "середи",
      "четверга",
      "п'ятниці",
      "суботи",
    ];
    return `Буду відкладати $${amount || "?"} кожного ${names[+day] ?? "?"} о ${t}`;
  }
  return `Буду відкладати $${amount || "?"} кожного ${day || "?"}-го числа о ${t}`;
}

function NewJarModal({
  onClose,
  onCreate,
  apy,
}: {
  onClose: () => void;
  onCreate: (params: {
    jarName: string;
    mode: number;
    unlockDate: number;
    goalAmount: number;
    currency: "usdc" | "sol";
    recurring: RecurringParams | null;
    groupTrip: GroupTripParams | null;
  }) => Promise<void>;
  apy: { usdc_kamino: number; sol_marinade: number };
}) {
  const [unlockType, setUnlockType] = useState<"goal" | "date" | "both">("goal");
  const [currency, setCurrency] = useState<"usdc" | "sol">("usdc");
  const [jarName, setJarName] = useState("");
  const [goalInput, setGoalInput] = useState("");
  const [dateInput, setDateInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [jarType, setJarType] = useState<"personal" | "group">("personal");
  const [tripName, setTripName] = useState("");
  const [tripEmoji, setTripEmoji] = useState("✈️");
  const [tripDate, setTripDate] = useState("");
  const [budgetPerPerson, setBudgetPerPerson] = useState("");
  const [myNickname, setMyNickname] = useState("");

  const [recurEnabled, setRecurEnabled] = useState(false);
  const [recurAmount, setRecurAmount] = useState("");
  const [recurFrequency, setRecurFrequency] = useState<"weekly" | "monthly">("monthly");
  const [recurDay, setRecurDay] = useState("1");
  const [recurTime, setRecurTime] = useState("09:00");

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="font-display text-2xl font-semibold">
              Create a Jar 🏺
            </div>
            <div className="mt-1 text-sm text-ink-muted">
              Set a goal, a date, or both. Smart contract unlocks automatically.
            </div>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-black/5">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Jar type */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          {(
            [
              ["personal", "🏺 Особиста", "Ціль, дата, регулярні внески"],
              ["group", "✈️ Групова поїздка", "Спільна мета для кількох людей"],
            ] as const
          ).map(([type, label, sub]) => (
            <button
              key={type}
              onClick={() => setJarType(type)}
              className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                jarType === type
                  ? "border-sol-purple bg-surface-lavender"
                  : "border-black/10 hover:border-black/20"
              }`}
            >
              <div className="text-sm font-semibold">{label}</div>
              <div className="mt-0.5 text-[11px] text-ink-muted">{sub}</div>
            </button>
          ))}
        </div>

        {jarType === "group" ? (
          <div className="mt-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Назва поїздки
              </label>
              <input
                placeholder="Японія 2026, Балі з друзями…"
                value={tripName}
                onChange={(e) => setTripName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Emoji напрямку
              </label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {[
                  "✈️","🗾","🏖️","🏔️","🗺️","🏝️","🌍","🎌","🌏","🇮🇹",
                ].map((e) => (
                  <button
                    key={e}
                    onClick={() => setTripEmoji(e)}
                    className={`h-10 w-10 rounded-xl text-xl transition ${
                      tripEmoji === e
                        ? "bg-surface-lavender ring-2 ring-sol-purple"
                        : "bg-[#FAFAF8] hover:bg-black/5"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                  Дата поїздки
                </label>
                <input
                  type="date"
                  value={tripDate}
                  onChange={(e) => setTripDate(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                  Бюджет / особу ($)
                </label>
                <input
                  type="number"
                  placeholder="1500"
                  value={budgetPerPerson}
                  onChange={(e) => setBudgetPerPerson(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Твоє ім&apos;я у групі
              </label>
              <input
                placeholder="Аня, Vasyl…"
                value={myNickname}
                onChange={(e) => setMyNickname(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
              />
            </div>
            {tripName && budgetPerPerson && (
              <div className="rounded-xl bg-surface-lavender p-3 text-xs font-medium text-sol-purple">
                {tripEmoji} {tripName} · $
                {parseFloat(budgetPerPerson || "0").toLocaleString()} / особу
                {tripDate
                  ? ` · ${new Date(tripDate).toLocaleDateString("uk-UA", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}`
                  : ""}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Jar name */}
            <div className="mt-5">
              <label className="block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Jar name
              </label>
              <input
                placeholder="e.g. Anya's Future, Japan Trip…"
                value={jarName}
                onChange={(e) => setJarName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-sol-purple"
              />
            </div>

            {/* Currency */}
            <div className="mt-5">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-ink-muted">
                Currency
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setCurrency("usdc")}
                  className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                    currency === "usdc"
                      ? "border-sol-purple bg-surface-lavender"
                      : "border-black/10 hover:border-black/20"
                  }`}
                >
                  <div className="text-sm font-semibold">💵 USDC</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">
                    Stable · ~{apy.usdc_kamino}% APY via Kamino
                  </div>
                </button>
                <button
                  onClick={() => setCurrency("sol")}
                  className={`rounded-xl border-2 px-4 py-3 text-left transition ${
                    currency === "sol"
                      ? "border-sol-purple bg-surface-lavender"
                      : "border-black/10 hover:border-black/20"
                  }`}
                >
                  <div className="text-sm font-semibold">◎ SOL</div>
                  <div className="mt-0.5 text-[11px] text-ink-muted">
                    Volatile · ~{apy.sol_marinade}% APY via Marinade
                  </div>
                </button>
              </div>
            </div>

            {/* Unlock condition */}
            <div className="mt-5">
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

              {/* Recurring deposit */}
              <button
                onClick={() => setRecurEnabled(!recurEnabled)}
                className="flex w-full items-center justify-between rounded-xl border border-black/10 px-4 py-3 text-left hover:border-black/20"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <RefreshCw className="h-4 w-4 text-sol-purple" /> Регулярний
                    внесок від мене
                  </div>
                  <div className="text-xs text-ink-muted">
                    Push-нагадування + авто-план поповнень
                  </div>
                </div>
                <div
                  className={`h-6 w-10 rounded-full p-0.5 transition ${
                    recurEnabled ? "bg-sol-purple" : "bg-black/10"
                  }`}
                >
                  <div
                    className={`h-5 w-5 rounded-full bg-white transition ${
                      recurEnabled ? "translate-x-4" : ""
                    }`}
                  />
                </div>
              </button>

              {recurEnabled && (
                <div className="space-y-3 rounded-xl border border-sol-purple/20 bg-surface-lavender p-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                        Сума ($)
                      </label>
                      <input
                        type="number"
                        placeholder="50"
                        value={recurAmount}
                        onChange={(e) => setRecurAmount(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-sol-purple"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                        Час
                      </label>
                      <input
                        type="time"
                        value={recurTime}
                        onChange={(e) => setRecurTime(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-sol-purple"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                      Частота
                    </label>
                    <div className="mt-1 grid grid-cols-2 gap-2">
                      {(["weekly", "monthly"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setRecurFrequency(f)}
                          className={`rounded-xl border-2 py-2 text-sm font-medium transition ${
                            recurFrequency === f
                              ? "border-sol-purple bg-white"
                              : "border-transparent bg-white/60 hover:border-black/10"
                          }`}
                        >
                          {f === "weekly" ? "Щотижня" : "Щомісяця"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-widest text-ink-muted">
                      {recurFrequency === "weekly"
                        ? "День тижня"
                        : "Число місяця (1–28)"}
                    </label>
                    {recurFrequency === "weekly" ? (
                      <select
                        value={recurDay}
                        onChange={(e) => setRecurDay(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-sol-purple"
                      >
                        {[
                          "Неділя","Понеділок","Вівторок","Середа","Четвер","П'ятниця","Субота",
                        ].map((d, i) => (
                          <option key={i} value={i}>
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        min={1}
                        max={28}
                        value={recurDay}
                        onChange={(e) => setRecurDay(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm outline-none focus:border-sol-purple"
                      />
                    )}
                  </div>
                  <div className="rounded-xl bg-white/70 px-4 py-2.5 text-xs font-medium text-sol-purple">
                    {recurLabel(recurAmount, recurFrequency, recurDay, recurTime)}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

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
              setSubmitting(true);
              try {
                if (jarType === "group") {
                  const tripDateTs = tripDate
                    ? Math.floor(new Date(tripDate).getTime() / 1000)
                    : 0;
                  const budgetCents = Math.round(
                    parseFloat(budgetPerPerson || "0") * 100
                  );
                  const goalAmount = Math.round(
                    parseFloat(budgetPerPerson || "0") * 1_000_000
                  );
                  await onCreate({
                    jarName: tripName,
                    mode: 0,
                    unlockDate: tripDateTs,
                    goalAmount,
                    currency: "usdc",
                    recurring: null,
                    groupTrip: {
                      trip_name: tripName,
                      destination_emoji: tripEmoji,
                      trip_date: tripDateTs,
                      budget_per_person_cents: budgetCents,
                      owner_nickname: myNickname,
                    },
                  });
                } else {
                  const mode =
                    unlockType === "goal"
                      ? 1
                      : unlockType === "date"
                      ? 0
                      : 2;
                  const unlockDate = dateInput
                    ? Math.floor(new Date(dateInput).getTime() / 1000)
                    : 0;
                  const goalAmount = goalInput
                    ? currency === "usdc"
                      ? Math.round(parseFloat(goalInput) * 1_000_000)
                      : Math.round(parseFloat(goalInput) * 1_000_000_000)
                    : 0;
                  let recurring: RecurringParams | null = null;
                  if (recurEnabled && recurAmount) {
                    const [hh, mm] = recurTime.split(":");
                    recurring = {
                      amount_usdc: Math.round(parseFloat(recurAmount) * 100),
                      frequency: recurFrequency,
                      day: parseInt(recurDay, 10),
                      hour: parseInt(hh ?? "9", 10),
                      minute: parseInt(mm ?? "0", 10),
                    };
                  }
                  await onCreate({
                    jarName,
                    mode,
                    unlockDate,
                    goalAmount,
                    currency,
                    recurring,
                    groupTrip: null,
                  });
                }
              } finally {
                setSubmitting(false);
              }
            }}
            className="flex-1 rounded-full bg-ink py-3 text-sm font-medium text-white disabled:opacity-40"
          >
            {submitting
              ? "Creating…"
              : jarType === "group"
              ? "Створити поїздку ✈️"
              : "Create Jar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHARED COMPONENTS
// ---------------------------------------------------------------------------

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
      <div className="mt-2 font-display text-2xl font-semibold md:text-3xl">
        {value}
      </div>
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
    <div className="mt-5 rounded-2xl border border-black/5 bg-white p-6">
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
  const pct = Math.min(100, Math.round((jar.amount / jar.goal) * 100));
  const isUsdc = jar.currency === "usdc";

  const fmtAmount = isUsdc
    ? `$${jar.amount.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : `◎${jar.amount.toLocaleString(undefined, {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      })}`;

  const fmtGoal = isUsdc
    ? `$${jar.goal.toLocaleString()}`
    : `◎${jar.goal.toLocaleString()}`;

  return (
    <div className="cursor-pointer rounded-2xl border border-black/5 bg-[#FAFAF8] p-5 transition hover:-translate-y-0.5 hover:border-sol-purple hover:shadow-lg">
      <div className="flex items-start justify-between">
        <div className="text-3xl">{jar.emoji}</div>
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${
              isUsdc
                ? "bg-surface-mint text-green-700"
                : "bg-surface-sky text-blue-700"
            }`}
          >
            {isUsdc ? "USDC" : "SOL"}
          </span>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
              jar.locked
                ? "bg-surface-lavender text-sol-purple"
                : "bg-surface-cream text-amber-700"
            }`}
          >
            {jar.locked ? "🔒 Locked" : "Open"}
          </span>
        </div>
      </div>
      <div className="mt-3 font-display text-lg font-semibold">{jar.name}</div>
      <div className="text-xs text-ink-muted">{jar.description}</div>
      <div className="mt-3 font-display text-2xl font-semibold">{fmtAmount}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/5">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sol-purple to-sol-blue"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-ink-faint">
        <span>
          {pct}% of {fmtGoal}
        </span>
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
        className={`flex-shrink-0 text-sm font-semibold ${
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
        {name[0]?.toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        <div className="truncate text-[11px] text-ink-muted">{comment}</div>
      </div>
      <div className="flex-shrink-0 text-sm font-semibold text-green-600">
        {amount}
      </div>
    </div>
  );
}
