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

function getJarEmoji(pubkey: string, fallback = "🏺"): string {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(`jar_emoji_${pubkey}`) ?? fallback;
}

function saveJarEmoji(pubkey: string, emoji: string) {
  if (typeof window === "undefined") return;
  if (emoji) localStorage.setItem(`jar_emoji_${pubkey}`, emoji);
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
  futureValue?: number;
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

        const yearsLeft = unlockDate > 0
          ? Math.max(1, (unlockDate - Date.now() / 1000) / (365.25 * 86400))
          : 5;
        const apr = isUsdc ? (apy.usdc_kamino / 100) : (apy.sol_marinade / 100);
        const futureValue = Math.round(displayAmount * Math.pow(1 + apr, yearsLeft) * 100) / 100;

        return {
          id: j.pubkey,
          emoji: getJarEmoji(j.pubkey, isUsdc ? "🫙" : "🫙"),
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
          futureValue,
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
    <div style={{ display: "flex", minHeight: "100vh", background: "var(--bg)", fontFamily: "var(--font)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-shrink-0 flex-col
          md:relative md:translate-x-0
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ width: 220, background: "var(--bg)", borderRight: "1px solid var(--border)", padding: "24px 0" }}
      >
        <Link
          href="/"
          onClick={() => setSidebarOpen(false)}
          style={{ display: "block", padding: "4px 24px 28px", fontSize: 18, fontWeight: 600, textDecoration: "none", color: "var(--text-primary)", letterSpacing: "-0.3px" }}
        >
          jar<span style={{ color: "var(--green)" }}>fi</span>
        </Link>

        <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, padding: "0 12px" }}>
          <NavItem label="My jars" icon="🫙" active={activePage === "dashboard" || activePage === "jars"} onClick={() => navigate("dashboard")} />
          <NavItem label="Create jar" icon="+" active={false} onClick={() => { setSidebarOpen(false); setModal("new-jar"); }} />
          {normalizedLive.length > 0 && (
            <NavItem label="Analytics" icon="📊" active={activePage === "analytics"} onClick={() => navigate("analytics")} />
          )}
        </nav>

        <div style={{ padding: "16px 12px 0", borderTop: "1px solid var(--border)", margin: "0 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-muted)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>
              {greeting ? greeting.slice(0, 2).toUpperCase() : "—"}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{greeting ?? "Not connected"}</div>
              {jarsLoading && <div style={{ fontSize: 11, color: "var(--text-tertiary)" }}>Loading…</div>}
            </div>
          </div>
        </div>
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
              if (params.jarEmoji) saveJarEmoji(jarPubkey, params.jarEmoji);
              // Persist name+emoji to backend so gift page can display them
              fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:3001"}/jar/meta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pubkey: jarPubkey, name: params.jarName, emoji: params.jarEmoji }),
              }).catch(() => {});
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
        {hasWallet && (
          <JupiterSwapButton className="hidden items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-medium text-ink transition hover:bg-black/5 md:inline-flex" />
        )}
        {hasWallet && (
          <button
            onClick={onNewJar}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Jar</span>
          </button>
        )}
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
            <div className={`mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${liveJars.length === 0 ? "hidden" : ""}`}>
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
            <div className={`mb-5 grid gap-5 lg:grid-cols-[2fr_1fr] ${liveJars.length === 0 ? "hidden" : ""}`}>
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
                <div style={{ maxWidth: 360, margin: "40px auto", textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 24 }}>🫙</div>
                  <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.5px", marginBottom: 10 }}>Start your first jar</div>
                  <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 28 }}>
                    Save for something that matters.<br />Alone or with people around you.
                  </div>
                  <button
                    onClick={onNewJar}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 8,
                      background: "var(--text-primary)", color: "#fff",
                      fontSize: 14, fontWeight: 500, padding: "11px 22px",
                      borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font)",
                    }}
                  >
                    Create a jar
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
    jarEmoji: string;
    mode: number;
    unlockDate: number;
    goalAmount: number;
    currency: "usdc" | "sol";
    recurring: RecurringParams | null;
    groupTrip: GroupTripParams | null;
  }) => Promise<void>;
  apy: { usdc_kamino: number; sol_marinade: number };
})
{
  const EMOJIS = ["🫙","🎯","✈️","🏖️","🏍️","🚗","🏡","👧","👶","🎓","💍","🎸","📱","💪","🌍","🎁","💰","🐕","🌱","🏋️"];
  const TOTAL_STEPS = 5;

  const [step, setStep] = useState(1);
  const [jarName, setJarName] = useState("");
  const [jarEmoji, setJarEmoji] = useState("🫙");
  const [goalInput, setGoalInput] = useState("");
  const [selectedYears, setSelectedYears] = useState<number | null>(5);
  const [customDate, setCustomDate] = useState("");
  const [recurChoice, setRecurChoice] = useState<"monthly" | "once">("monthly");
  const [recurAmount, setRecurAmount] = useState("100");
  const [submitting, setSubmitting] = useState(false);

  const { publicKey } = useWallet();
  const walletConnected = !!publicKey;

  const goalUsd = parseFloat(goalInput) || 0;
  const years = selectedYears ?? (customDate ? Math.max(1, Math.round((new Date(customDate).getTime() - Date.now()) / (365.25 * 86400 * 1000))) : 5);
  const monthly = recurChoice === "monthly" ? (parseFloat(recurAmount) || 100) : 0;
  const rJ = 0.055 / 12;
  const n = years * 12;
  const projJarfi = Math.round(monthly * ((Math.pow(1 + rJ, n) - 1) / rJ));
  const projBank = Math.round(monthly * ((Math.pow(1 + 0.02/12, n) - 1) / (0.02/12)));

  async function handleCreate() {
    setSubmitting(true);
    try {
      const unlockDate = customDate
        ? Math.floor(new Date(customDate).getTime() / 1000)
        : selectedYears
        ? Math.floor(Date.now() / 1000) + selectedYears * 365.25 * 86400
        : 0;
      const goalAmount = goalUsd > 0 ? Math.round(goalUsd * 1_000_000) : 0;
      const mode = unlockDate > 0 && goalAmount > 0 ? 2 : goalAmount > 0 ? 1 : 0;
      const recurring: RecurringParams | null = recurChoice === "monthly" && monthly > 0
        ? { amount_usdc: Math.round(monthly * 100), frequency: "monthly", day: 1, hour: 9, minute: 0 }
        : null;
      await onCreate({ jarName, jarEmoji, mode, unlockDate, goalAmount, currency: "usdc", recurring, groupTrip: null });
    } finally {
      setSubmitting(false);
    }
  }

  const dots = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1);

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 24, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 480, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, padding: 40, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step dots */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginBottom: 36 }}>
          {dots.map((d) => (
            <div key={d} style={{
              height: 4, borderRadius: 2,
              width: d === step ? 24 : 8,
              background: d < step ? "var(--green)" : d === step ? "var(--text-primary)" : "var(--border)",
              transition: "all 0.3s",
            }} />
          ))}
        </div>

        {/* ── STEP 1: Name ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Step 1 of {TOTAL_STEPS}</div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>What are you saving for?</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 6 }}>Give your jar a name — it&apos;ll appear on the gift link you share with friends and family.</div>
            </div>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  style={{ height: 44, width: 44, flexShrink: 0, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 22, cursor: "pointer" }}
                  onClick={() => { const i = EMOJIS.indexOf(jarEmoji); setJarEmoji(EMOJIS[(i + 1) % EMOJIS.length]); }}
                  title="Click to change emoji"
                >{jarEmoji}</button>
                <input
                  autoFocus
                  placeholder="E.g. Eva's 18th Birthday"
                  value={jarName}
                  onChange={(e) => setJarName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && jarName.trim() && setStep(2)}
                  style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 17, fontFamily: "var(--font)", outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setJarEmoji(e)} style={{ height: 36, width: 36, borderRadius: 8, fontSize: 18, cursor: "pointer", border: "1px solid", borderColor: jarEmoji === e ? "var(--text-primary)" : "var(--border)", background: jarEmoji === e ? "var(--bg-muted)" : "var(--bg)" }}>{e}</button>
                ))}
              </div>
            </div>
            <FlowNav onNext={() => setStep(2)} nextDisabled={!jarName.trim()} />
          </div>
        )}

        {/* ── STEP 2: Goal ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Step 2 of {TOTAL_STEPS}</div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>Do you have a goal?</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 6 }}>A goal helps track progress — e.g. $10,000 for a car. Skip it if you just want to save until a certain date.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15, fontWeight: 600, background: "var(--bg-muted)", color: "var(--text-secondary)", minWidth: 48, textAlign: "center" }}>$</div>
              <input
                autoFocus
                type="number"
                placeholder="10,000"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setStep(3)}
                style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none" }}
              />
            </div>
            <button
              onClick={() => { setGoalInput(""); setStep(3); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", background: "var(--bg)", fontFamily: "var(--font)", textAlign: "left" }}
            >
              <span style={{ fontSize: 22, width: 36, textAlign: "center" }}>📅</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>No goal — save by time</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>The jar unlocks on a date you choose</div>
              </div>
            </button>
            <FlowNav onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}

        {/* ── STEP 3: Timeline ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Step 3 of {TOTAL_STEPS}</div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>When do you need it?</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 6 }}>Funds stay locked until this date, earning yield automatically. You can always unlock early if needed.</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[1, 3, 5, 10, 18, 0].map((y) => (
                <button key={y} onClick={() => { setSelectedYears(y || null); setCustomDate(""); }}
                  style={{ padding: 12, border: "1px solid", borderColor: selectedYears === y ? "var(--text-primary)" : "var(--border)", borderRadius: 8, cursor: "pointer", background: selectedYears === y ? "var(--bg-muted)" : "var(--bg)", fontFamily: "var(--font)", textAlign: "center" }}>
                  <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.5px" }}>{y || "—"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>{y === 0 ? "no deadline" : y === 1 ? "year" : "years"}</div>
                </button>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Or pick a specific date</div>
              <input
                type="date"
                value={customDate}
                onChange={(e) => { setCustomDate(e.target.value); setSelectedYears(null); }}
                style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none" }}
              />
            </div>
            <FlowNav onBack={() => setStep(2)} onNext={() => setStep(4)} />
          </div>
        )}

        {/* ── STEP 4: Recurring ── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Step 4 of {TOTAL_STEPS}</div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>Will you add funds regularly?</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 6 }}>Monthly auto-deposits happen from your wallet on the 1st of each month. You can pause or cancel anytime.</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { val: "monthly", icon: "🔄", title: "Yes — monthly", desc: "Set a recurring amount each month" },
                { val: "once",    icon: "💸", title: "No — one-time",  desc: "Just an initial deposit" },
              ].map((o) => (
                <button key={o.val} onClick={() => setRecurChoice(o.val as typeof recurChoice)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: "1px solid", borderColor: recurChoice === o.val ? "var(--text-primary)" : "var(--border)", borderRadius: 12, cursor: "pointer", background: recurChoice === o.val ? "var(--bg-muted)" : "var(--bg)", fontFamily: "var(--font)", textAlign: "left" }}>
                  <span style={{ fontSize: 22, width: 36, textAlign: "center" }}>{o.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)" }}>{o.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{o.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {recurChoice === "monthly" && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Monthly amount</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15, fontWeight: 600, background: "var(--bg-muted)", color: "var(--text-secondary)", minWidth: 48, textAlign: "center" }}>$</div>
                  <input type="number" value={recurAmount} onChange={(e) => setRecurAmount(e.target.value)} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none" }} />
                </div>
              </div>
            )}
            <FlowNav onBack={() => setStep(3)} onNext={() => setStep(5)} />
          </div>
        )}

        {/* ── STEP 5: Projection + Create ── */}
        {step === 5 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Step 5 of {TOTAL_STEPS}</div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>If you continue, you&apos;ll have:</div>
            </div>
            <div style={{ background: "var(--bg-muted)", borderRadius: 12, padding: 24 }}>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>Estimated future value</div>
              <div style={{ fontSize: 44, fontWeight: 600, color: "var(--green)", letterSpacing: "-1.5px", lineHeight: 1 }}>
                ${projJarfi.toLocaleString()}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>in {years} {years === 1 ? "year" : "years"}</div>
              <div style={{ marginTop: 20, paddingTop: 20, borderTop: "1px solid var(--border)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)" }}>Do nothing</span>
                  <span style={{ fontWeight: 500, color: "var(--text-tertiary)" }}>$0</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                  <span style={{ color: "var(--text-secondary)" }}>In a bank (2%)</span>
                  <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>${projBank.toLocaleString()}</span>
                </div>
              </div>
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
              This includes your contributions and growth over time.
            </div>
            {walletConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f0faf5", borderRadius: 8, fontSize: 13, color: "var(--green)" }}>
                <span>✓</span>
                <span>Wallet connected — ready to create</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-muted)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                <span>🔐</span>
                <span>Connect a wallet to create your jar. It only takes a moment.</span>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setStep(4)} style={{ fontSize: 14, color: "var(--text-secondary)", cursor: "pointer", padding: "13px 0", border: "none", background: "none", fontFamily: "var(--font)" }}>Back</button>
              {walletConnected ? (
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  style={{ flex: 1, background: "var(--green)", color: "#fff", fontSize: 15, fontWeight: 500, padding: "13px 20px", borderRadius: 8, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Creating…" : "Create your jar"}
                </button>
              ) : (
                <div style={{ flex: 1 }}>
                  <WalletButton />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHARED COMPONENTS
// ---------------------------------------------------------------------------

function FlowNav({ onBack, onNext, nextDisabled, nextLabel }: { onBack?: () => void; onNext?: () => void; nextDisabled?: boolean; nextLabel?: string; }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      {onBack && <button onClick={onBack} style={{ fontSize: 14, color: "var(--text-secondary)", cursor: "pointer", padding: "13px 0", border: "none", background: "none", fontFamily: "var(--font)" }}>Back</button>}
      {onNext && <button onClick={onNext} disabled={nextDisabled} style={{ flex: 1, background: "var(--text-primary)", color: "#fff", fontSize: 15, fontWeight: 500, padding: "13px 20px", borderRadius: 8, border: "none", cursor: nextDisabled ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: nextDisabled ? 0.4 : 1 }}>{nextLabel ?? "Continue"}</button>}
    </div>
  );
}

function NavItem({ label, icon, active, onClick }: {
  label: string; icon: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10, width: "100%",
        padding: "9px 12px", borderRadius: 8,
        background: active ? "var(--bg-muted)" : "transparent",
        color: active ? "var(--text-primary)" : "var(--text-secondary)",
        fontWeight: active ? 500 : 400, fontSize: 14,
        cursor: "pointer", border: "none", fontFamily: "var(--font)",
        textAlign: "left", transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: 16, width: 20, textAlign: "center" }}>{icon}</span>
      {label}
    </button>
  );
}

function StatCard({ label, value, change, highlight }: { label: string; value: string; change: string; highlight?: boolean; tint?: string; }) {
  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--bg)", padding: 20 }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 500 }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 28, fontWeight: 600, letterSpacing: "-0.8px", color: highlight ? "var(--green)" : "var(--text-primary)" }}>
        {value}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-tertiary)" }}>{change}</div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode; }) {
  return (
    <div style={{ marginTop: 20, borderRadius: 16, border: "1px solid var(--border)", background: "var(--bg)", padding: 24 }}>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 16, fontWeight: 500, letterSpacing: "-0.3px" }}>{title}</div>
        {action}
      </div>
      {children}
    </div>
  );
}

function CardAction({ label }: { label: string }) {
  return (
    <button style={{ fontSize: 13, color: "var(--text-secondary)", cursor: "pointer", border: "none", background: "none", fontFamily: "var(--font)" }}>
      {label}
    </button>
  );
}

function JarCard({ jar }: { jar: JarType }) {
  const pct = Math.min(100, Math.round((jar.amount / Math.max(jar.goal, 0.01)) * 100));
  const isUsdc = jar.currency === "usdc";
  const future = jar.futureValue ?? jar.amount;
  const fmtFuture = isUsdc ? `$${future.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `◎${future.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtSaved = isUsdc ? `$${jar.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `◎${jar.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  const yearsLeft = jar.unlockDate > 0 ? Math.max(0, Math.round((jar.unlockDate - Date.now() / 1000) / (365.25 * 86400))) : null;

  return (
    <div
      style={{
        background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16,
        padding: 28, display: "flex", flexDirection: "column", gap: 0,
        cursor: "pointer", transition: "box-shadow 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 24px rgba(0,0,0,0.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{jar.emoji} {jar.name}</div>
        {yearsLeft !== null && (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", background: "var(--bg-muted)", padding: "3px 9px", borderRadius: 20 }}>
            {yearsLeft > 0 ? `${yearsLeft} yr${yearsLeft !== 1 ? "s" : ""} left` : "unlocking"}
          </div>
        )}
      </div>

      {/* Future value — primary */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 40, fontWeight: 600, color: "var(--green)", letterSpacing: "-1.5px", lineHeight: 1 }}>
          {fmtFuture}
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 3, display: "flex", alignItems: "center", gap: 4 }}>
          Estimated future value
          <span title="Projected value if you continue saving at this pace" style={{ width: 13, height: 13, borderRadius: "50%", border: "1px solid var(--text-tertiary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, cursor: "help" }}>?</span>
        </div>
      </div>

      {/* Saved — secondary */}
      <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 16, marginBottom: 12 }}>
        <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{fmtSaved}</strong> saved so far
      </div>

      {/* Progress */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--text-tertiary)", marginBottom: 6 }}>
          <span>Progress to goal</span><span>{pct}%</span>
        </div>
        <div style={{ height: 4, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "var(--green)", borderRadius: 2 }} />
        </div>
      </div>

      <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
        {jar.locked ? "🔒 Locked" : "Open"} · {jar.unlockLabel}
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
