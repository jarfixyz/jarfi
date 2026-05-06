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
import { useJars } from "@/lib/use-jars";
import { createUsdcJarOnChain } from "@/lib/create-jar";
import { breakUsdcJarOnChain } from "@/lib/break-jar";
import { CURRENCY_USDC, fetchJarByPubkey } from "@/lib/program";
import { PublicKey } from "@solana/web3.js";
import {
  fetchApy,
  createScheduleApi,
  fetchSchedules,
  stopScheduleApi,
  updateScheduleApi,
  type Schedule,
  createGroupApi,
  fetchGroupsByOwner,
  type GroupInfo,
  fetchContributionsForJar,
  type JarContribution,
  createCosignerInvite,
  fetchCosigners,
  type Cosigner,
} from "@/lib/api";
import { subscribeToPush } from "@/lib/push";
import TransakWidget from "@/components/TransakWidget";
import { contractToJarType, jarTypeToContract, JAR_TYPE_LABELS, JAR_TYPE_ICONS, UNLOCK_RULE_LABEL, unlockRuleForType, STEP_FLOWS, JAR_TYPE_DESCRIPTIONS } from "@/lib/jarTypes";
import type { JarType as JarTypeEnum, StepName } from "@/lib/jarTypes";

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

function getJarSlug(pubkey: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`jar_slug_${pubkey}`) ?? null;
}

function saveJarSlug(pubkey: string, slug: string) {
  if (typeof window === "undefined") return;
  if (slug) localStorage.setItem(`jar_slug_${pubkey}`, slug);
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
// calcNextRun — computes next fire date from schedule fields
// ---------------------------------------------------------------------------

function calcNextRun(s: Schedule): Date {
  const now = new Date();
  const next = new Date(now);
  next.setSeconds(0, 0);
  next.setHours(s.hour, s.minute, 0, 0);

  if (s.frequency === "monthly") {
    next.setDate(s.day);
    if (next <= now) {
      next.setMonth(next.getMonth() + 1);
      next.setDate(s.day);
    }
  } else {
    const diff = (s.day - now.getDay() + 7) % 7;
    next.setDate(now.getDate() + diff);
    if (diff === 0 && next <= now) next.setDate(next.getDate() + 7);
  }
  return next;
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
  jarType: JarTypeEnum;
  mode: number;
};

// ---------------------------------------------------------------------------
// Dashboard root
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [activePage, setActivePage] = useState<
    "dashboard" | "jars" | "analytics" | "contributors"
  >("dashboard");
  const [modal, setModal] = useState<"new-jar" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scenario, setScenario] = useState(50);

  const { publicKey, wallet } = useWallet();
  const { connection } = useConnection();
  const { jars: liveJars, loading: jarsLoading, refresh: refreshJars, addJar, removeJar } = useJars();
  const [apy, setApy] = useState({ usdc_kamino: 8.2, sol_marinade: 6.85 });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [contributions, setContributions] = useState<JarContribution[]>([]);
  const [confirmBanner, setConfirmBanner] = useState<{
    jar_pubkey: string;
    amount_usdc: number;
    manual?: boolean;
  } | null>(null);
  const [showDepositTransak, setShowDepositTransak] = useState(false);
  const [addFundsJar, setAddFundsJar] = useState<{ pubkey: string; name: string; currency: "usdc" | "sol" } | null>(null);
  const [initialDepositPrompt, setInitialDepositPrompt] = useState<{ pubkey: string; name: string; currency: "usdc" | "sol" } | null>(null);
  const [cosignerInvite, setCosignerInvite] = useState<{ jar_pubkey: string; token: string; name: string } | null>(null);

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
    Promise.all(liveJars.map(j => fetchContributionsForJar(j.pubkey)))
      .then(all => {
        const seen = new Set<string>();
        const merged = all.flat().filter(c => seen.has(c.pubkey) ? false : (seen.add(c.pubkey), true));
        setContributions(merged);
      })
      .catch(() => {});
  }, [liveJars]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const jar_pubkey = p.get("confirm");
    const amount_usdc = Number(p.get("amount") ?? 0);
    const manual = p.get("manual") === "1";
    if (jar_pubkey) setConfirmBanner({ jar_pubkey, amount_usdc, manual });
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
        const unlockDate = j.unlockDate;
        const jarType: JarTypeEnum = contractToJarType(j.mode, j.unlockDate);
        const modeLabel = JAR_TYPE_LABELS[jarType];
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
          goal: displayGoal,
          locked: !j.unlocked,
          unlockLabel: modeLabel,
          currency: isUsdc ? "usdc" : "sol",
          unlockDate,
          futureValue,
          jarType,
          mode: j.mode,
        };
      }),
    [liveJars]
  );

  const greeting = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F5F5F2", fontFamily: "var(--font)" }}>
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
        style={{ width: 192, background: "#FFFFFF", borderRight: "1px solid #E2E2DC", padding: "20px 0", minHeight: "100vh" }}
      >
        {/* Logo */}
        <Link
          href="/"
          onClick={() => setSidebarOpen(false)}
          style={{ display: "block", padding: "0 18px 22px", fontSize: 16, fontWeight: 700, textDecoration: "none", color: "#111111", letterSpacing: "-0.4px" }}
        >
          jar<span style={{ color: "#059669" }}>fi</span>
        </Link>

        {/* SAVINGS section */}
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#999999", letterSpacing: "0.8px", textTransform: "uppercase", padding: "12px 8px 6px" }}>Savings</div>
          <NavItem label="My jars" icon="🫙" active={activePage === "dashboard" || activePage === "jars"} onClick={() => navigate("dashboard")} />
          <NavItem label="New jar" icon="＋" active={false} onClick={() => { setSidebarOpen(false); setModal("new-jar"); }} />
        </div>

        {/* INSIGHTS section */}
        <div style={{ padding: "0 10px", display: "flex", flexDirection: "column", gap: 1, marginTop: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#999999", letterSpacing: "0.8px", textTransform: "uppercase", padding: "12px 8px 6px" }}>Insights</div>
          <NavItem label="Analytics" icon="📊" active={activePage === "analytics"} onClick={() => navigate("analytics")} />
          <NavItem label="Contributors" icon="👥" active={activePage === "contributors"} onClick={() => navigate("contributors")} />
        </div>

        {/* APY pill */}
        <div style={{ margin: "12px 10px 0", padding: "8px 10px", background: "#ECFDF5", borderRadius: 9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>USDC (Kamino)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{apy.usdc_kamino}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
            <span style={{ fontSize: 10, color: "#059669", fontWeight: 600 }}>SOL (Marinade)</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "#059669" }}>{apy.sol_marinade}%</span>
          </div>
        </div>

        {/* User footer */}
        <div style={{ marginTop: "auto", padding: "14px 10px 0", borderTop: "1px solid #E2E2DC" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 8px", borderRadius: 9, cursor: "pointer" }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "rgba(5,150,105,.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#059669", flexShrink: 0 }}>
              {greeting ? greeting.slice(0, 2).toUpperCase() : "—"}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111111" }}>{greeting ? `${greeting.slice(0, 4)}…` : "Not connected"}</div>
              {jarsLoading && <div style={{ fontSize: 10, color: "#999999" }}>Loading…</div>}
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
              {confirmBanner.manual
                ? `⚠️ Reminder — deposit $${(confirmBanner.amount_usdc / 100).toFixed(2)} manually`
                : `⏰ Time to top up — $${(confirmBanner.amount_usdc / 100).toFixed(2)} → Jar ${confirmBanner.jar_pubkey.slice(0, 4)}…${confirmBanner.jar_pubkey.slice(-4)}`}
            </span>
            <div className="ml-4 flex items-center gap-2">
              <button
                onClick={() => setShowDepositTransak(true)}
                className="rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-sol-purple hover:bg-white/90"
              >
                Top up
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
            fiatAmount={confirmBanner.amount_usdc > 0 ? confirmBanner.amount_usdc / 100 : undefined}
            contributorMessage="Monthly contribution"
            onSuccess={() => {
              setShowDepositTransak(false);
              setConfirmBanner(null);
              showToast("Deposit confirmed ✅");
              refreshJars();
            }}
            onClose={() => setShowDepositTransak(false)}
          />
        )}

        {addFundsJar && (
          <TransakWidget
            vaultAddress={addFundsJar.pubkey}
            contributorMessage={`Top up ${addFundsJar.name}`}

            onSuccess={() => {
              setAddFundsJar(null);
              showToast("Deposit confirmed ✅");
              refreshJars();
            }}
            onClose={() => setAddFundsJar(null)}
          />
        )}

        {/* Initial deposit prompt after jar creation */}
        {initialDepositPrompt && (
          <div style={{ background: "#ECFDF5", borderBottom: "1px solid rgba(5,150,105,.25)", padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <span style={{ fontSize: 13, color: "#059669", fontWeight: 500 }}>
              🏺 <strong>{initialDepositPrompt.name}</strong> created — add your first deposit?
            </span>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => { setAddFundsJar({ pubkey: initialDepositPrompt.pubkey, name: initialDepositPrompt.name, currency: initialDepositPrompt.currency }); setInitialDepositPrompt(null); }}
                style={{ fontSize: 12, fontWeight: 600, padding: "6px 14px", background: "#059669", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "var(--font)" }}
              >
                + Add funds
              </button>
              <button
                onClick={() => setInitialDepositPrompt(null)}
                style={{ fontSize: 12, color: "#059669", background: "none", border: "none", cursor: "pointer" }}
              >
                Later
              </button>
            </div>
          </div>
        )}

        {/* Cosigner invite modal */}
        {cosignerInvite && (
          <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.45)", padding: 24 }} onClick={() => setCosignerInvite(null)}>
            <div style={{ width: "100%", maxWidth: 460, background: "#fff", borderRadius: 20, padding: 36 }} onClick={e => e.stopPropagation()}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>👨‍👩‍👧</div>
              <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.5px", marginBottom: 6 }}>Family Approval set up</div>
              <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 20 }}>
                Share this invite link with your co-signer. They connect their wallet to activate family approval for <strong>{cosignerInvite.name}</strong>.
                <br /><span style={{ fontSize: 12, color: "#999", marginTop: 4, display: "block" }}>Soft approval · on-chain enforcement coming soon</span>
              </div>
              <CopyField value={`${typeof window !== "undefined" ? window.location.origin : "https://jarfi.xyz"}/invite/${cosignerInvite.token}`} />
              <button onClick={() => setCosignerInvite(null)} style={{ width: "100%", marginTop: 16, padding: "11px 0", background: "#111", color: "#fff", borderRadius: 9, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>Done</button>
            </div>
          </div>
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
            onScheduleUpdate={(updated) => setSchedules(updated)}
            groups={groups}
            contributions={contributions}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
            onAddFunds={(pubkey, name, currency) => setAddFundsJar({ pubkey, name, currency })}
            onJarBroken={removeJar}
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
            onBack={() => navigate("dashboard")}
          />
        )}
        {activePage === "contributors" && (
          <ContributorsPage
            contributions={contributions}
            liveJars={normalizedLive}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
            onBack={() => navigate("dashboard")}
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
              ({ jarPubkey } = await createUsdcJarOnChain(
                wallet.adapter as never,
                connection,
                { ...params, childWallet }
              ));
              if (params.jarName) saveJarName(jarPubkey, params.jarName);
              if (params.jarEmoji) saveJarEmoji(jarPubkey, params.jarEmoji);
              fetchJarByPubkey(connection, new PublicKey(jarPubkey))
                .then(jar => { if (jar) addJar(jar); })
                .catch(() => {});
              fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app"}/jar/meta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pubkey: jarPubkey, name: params.jarName, emoji: params.jarEmoji, jarType: contractToJarType(params.mode, params.unlockDate) }),
              }).then(r => r.json()).then(d => { if (d.share_slug) saveJarSlug(jarPubkey, d.share_slug); }).catch(() => {});
              if (params.recurring) {
                try {
                  await createScheduleApi({
                    jar_pubkey: jarPubkey,
                    owner_pubkey: publicKey.toBase58(),
                    ...params.recurring,
                  });
                  setSchedules(await fetchSchedules(publicKey.toBase58()));
                } catch { /* backend offline — jar is created, schedule skipped */ }
              }
              if (params.groupTrip) {
                try {
                  await createGroupApi({
                    jar_pubkey: jarPubkey,
                    owner_pubkey: publicKey.toBase58(),
                    ...params.groupTrip,
                  });
                  setGroups(await fetchGroupsByOwner(publicKey.toBase58()));
                } catch { /* backend offline — jar is created, group skipped */ }
              }
              if (params.approvalMode === "FAMILY_APPROVAL") {
                try {
                  const token = await createCosignerInvite(jarPubkey);
                  setCosignerInvite({ jar_pubkey: jarPubkey, token, name: params.jarName });
                } catch { /* non-blocking */ }
              }
              setModal(null);
              refreshJars();
              if (!params.approvalMode || params.approvalMode === "NONE") {
                setInitialDepositPrompt({ pubkey: jarPubkey, name: params.jarName, currency: params.currency === 'usdc' ? 'usdc' : 'sol' });
              }
              showToast(params.groupTrip ? "Group trip created ✈️" : "Jar created 🏺");
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error("[create-jar] error:", msg);
              const friendly = msg.includes("rejected") || msg.includes("User rejected")
                ? "Transaction cancelled"
                : msg.includes("blockhash") || msg.includes("congested") || msg.includes("congestion")
                ? "Devnet congestion — please try again"
                : msg.includes("insufficient") || msg.includes("lamports")
                ? "Not enough SOL for fees"
                : msg.includes("timed out")
                ? "Network timeout — please try again"
                : msg.slice(0, 120);
              showToast("❌ " + friendly);
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
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onMenuToggle: () => void;
  onBack?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ background: "#FFFFFF", borderBottom: "1px solid #E2E2DC", padding: "0 20px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          onClick={onMenuToggle}
          className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-black/5 md:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        {onBack && (
          <button
            onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, fontWeight: 600, color: "#111", background: "#F4F4F0", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font)", whiteSpace: "nowrap" }}
          >
            ← My jars
          </button>
        )}
        {!onBack && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#111111" }}>{title}</div>
            {subtitle && <div style={{ fontSize: 13, color: "#999999" }}>{subtitle}</div>}
          </div>
        )}
        {onBack && (
          <div style={{ fontSize: 14, fontWeight: 600, color: "#111111" }}>{title}</div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>{children}</div>
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
  onScheduleUpdate,
  groups,
  contributions,
  onMenuToggle,
  onAddFunds,
  onJarBroken,
}: {
  onNewJar: () => void;
  scenario: number;
  setScenario: (s: number) => void;
  liveJars: JarType[];
  greeting: string | null;
  apy: { usdc_kamino: number; sol_marinade: number };
  schedules: Schedule[];
  onStopSchedule: (id: string) => Promise<void>;
  onScheduleUpdate: (schedules: Schedule[]) => void;
  groups: GroupInfo[];
  contributions: JarContribution[];
  onMenuToggle: () => void;
  onAddFunds: (pubkey: string, name: string, currency: "usdc" | "sol") => void;
  onJarBroken: (pubkey: string) => void;
}) {
  const hasWallet = !!greeting;
  const [selectedJar, setSelectedJar] = useState<JarType | null>(null);

  const totalSaved = liveJars.reduce((s, j) => s + j.amount, 0);
  const lockedCount = liveJars.filter((j) => j.locked).length;
  const estimatedYieldMonthly = liveJars.reduce((s, j) => {
    const rate =
      j.currency === "usdc" ? apy.usdc_kamino / 100 : apy.sol_marinade / 100;
    return s + (j.amount * rate) / 12;
  }, 0);
  const monthlyPlan = schedules.reduce((s, sc) => s + sc.amount_usdc / 100, 0);
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

  const [chartJar, setChartJar] = useState<JarType | null>(null);

  // Computed portfolio stats
  const totalFutureValue = liveJars.reduce((s, j) => s + (j.futureValue ?? j.amount), 0);
  const totalYieldEarned = liveJars.reduce((s, j) => {
    const rate = j.currency === "usdc" ? apy.usdc_kamino / 100 : apy.sol_marinade / 100;
    return s + j.amount * rate;
  }, 0);

  if (selectedJar) {
    return (
      <JarDetailPanel
        jar={selectedJar}
        apy={apy}
        schedules={schedules}
        onBack={() => setSelectedJar(null)}
        onMenuToggle={onMenuToggle}
        onAddFunds={onAddFunds}
        onScheduleUpdate={onScheduleUpdate}
        onJarBroken={(pubkey) => { onJarBroken(pubkey); setSelectedJar(null); }}
      />
    );
  }

  return (
    <>
      {/* TopBar */}
      <TopBar
        title="Dashboard"
        subtitle={greeting ? `Good morning ☀️` : "Good morning ☀️"}
        onMenuToggle={onMenuToggle}
      >
        <WalletButton compact />
        {hasWallet && (
          <button
            onClick={onNewJar}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#111111", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}
          >
            + New jar
          </button>
        )}
      </TopBar>

      <div style={{ padding: "24px 28px", flex: 1 }}>

        {/* No wallet — empty state */}
        {!hasWallet && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRadius: 14, border: "2px dashed #E2E2DC", background: "#FFFFFF", padding: "64px 24px", textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 56, marginBottom: 12 }}>🏺</div>
            <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>Connect your wallet to start</div>
            <div style={{ fontSize: 14, color: "#999999", marginBottom: 24 }}>See your jars, track yield, share gift links</div>
            <WalletButton />
          </div>
        )}

        {hasWallet && (
          <>
            {/* Portfolio card */}
            {liveJars.length > 0 && (
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E2DC", borderRadius: 14, padding: "24px 28px", marginBottom: 16, display: "flex", alignItems: "center", gap: 0 }}>
                {/* Total saved */}
                <div style={{ flexShrink: 0, marginRight: 36 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#999999", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>Total saved</div>
                  <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1.5px", color: "#111111", lineHeight: 1 }}>${totalSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={{ fontSize: 12, color: "#999999", marginTop: 3 }}>across {liveJars.length} jar{liveJars.length !== 1 ? "s" : ""}</div>
                </div>
                {/* Divider */}
                <div style={{ width: 1, height: 52, background: "#E2E2DC", margin: "0 28px", flexShrink: 0 }} />
                {/* Future value */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#999999", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>Future value</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.6px", color: "#059669" }}>${Math.round(totalFutureValue).toLocaleString()}</div>
                  <div style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>est. at unlock</div>
                </div>
                {/* Divider */}
                <div style={{ width: 1, height: 52, background: "#E2E2DC", margin: "0 28px", flexShrink: 0 }} />
                {/* Yield earned */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#999999", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>Yield earned</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.6px", color: "#059669" }}>${totalYieldEarned.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>this year · staking</div>
                </div>
                {/* Divider */}
                <div style={{ width: 1, height: 52, background: "#E2E2DC", margin: "0 28px", flexShrink: 0 }} />
                {/* Monthly yield */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#999999", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>Monthly yield</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.6px", color: "#111111" }}>${estimatedYieldMonthly.toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>Kamino + Marinade</div>
                </div>
                {/* Divider */}
                <div style={{ width: 1, height: 52, background: "#E2E2DC", margin: "0 28px", flexShrink: 0 }} />
                {/* Contributors */}
                <div style={{ flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#999999", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>Contributors</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.6px", color: "#111111" }}>{uniqueContributors || contributions.length}</div>
                  <div style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>across all jars</div>
                </div>
                {monthlyPlan > 0 && <>
                  {/* Divider */}
                  <div style={{ width: 1, height: 52, background: "#E2E2DC", margin: "0 28px", flexShrink: 0 }} />
                  {/* Monthly plan */}
                  <div style={{ flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#999999", letterSpacing: "0.7px", textTransform: "uppercase", marginBottom: 4 }}>Monthly plan</div>
                    <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.6px", color: "#111111" }}>${monthlyPlan.toFixed(0)}</div>
                    <div style={{ fontSize: 11, color: "#999999", marginTop: 2 }}>{schedules.length} reminder{schedules.length !== 1 ? "s" : ""} active</div>
                  </div>
                </>}
                {/* Actions */}
                <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                  <button
                    onClick={onNewJar}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, background: "#111111", color: "#fff", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}
                  >
                    + New jar
                  </button>
                </div>
              </div>
            )}

            {/* Yield strip */}
            {liveJars.length > 0 && (
              <div style={{ background: "#ECFDF5", border: "1px solid rgba(5,150,105,.2)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#059669" }}>
                  <span style={{ fontSize: 15 }}>⚡</span>
                  <span>Your jars are earning <strong>${estimatedYieldMonthly.toFixed(2)} this month</strong> via automatic staking on Kamino and Marinade — no action needed.</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#059669", opacity: 0.8, flexShrink: 0, marginLeft: 16 }}>+{apy.sol_marinade}–{apy.usdc_kamino}% APY →</div>
              </div>
            )}

            {/* Chart panel — inline, above jar grid */}
            {chartJar && (
              <JarChartPanel
                jar={chartJar}
                apy={apy}
                onClose={() => setChartJar(null)}
              />
            )}

            {/* Jars section */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, marginTop: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#111111" }}>My jars</div>
              {liveJars.length > 0 && <span onClick={onNewJar} style={{ fontSize: 12, color: "#999999", cursor: "pointer" }}>+ New jar</span>}
            </div>

            {/* Jars grid */}
            {liveJars.length === 0 ? (
              <div style={{ maxWidth: 360, margin: "40px auto", textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 24 }}>🫙</div>
                <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.5px", marginBottom: 10 }}>Start your first jar</div>
                <div style={{ fontSize: 15, color: "#555555", lineHeight: 1.6, marginBottom: 28 }}>
                  Save for something that matters.<br />Alone or with people around you.
                </div>
                <button
                  onClick={onNewJar}
                  style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#111111", color: "#fff", fontSize: 14, fontWeight: 500, padding: "11px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font)" }}
                >
                  Create a jar
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                {liveJars.map((j) => (
                  <NewJarCard
                    key={j.id}
                    jar={j}
                    isChartActive={chartJar?.id === j.id}
                    onSelect={() => setSelectedJar(j)}
                    onChart={(e) => {
                      e.stopPropagation();
                      setChartJar(chartJar?.id === j.id ? null : j);
                    }}
                    onAddFunds={(e) => {
                      e.stopPropagation();
                      onAddFunds(j.id, j.name, j.currency as "usdc" | "sol");
                    }}
                  />
                ))}
                {/* Add jar card */}
                <AddJarCard onClick={onNewJar} />
              </div>
            )}

            {/* Group Trip jars */}
            {groups.length > 0 && (
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E2DC", borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Group trips ✈️</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {groups.map((g) => {
                    const daysLeft = Math.max(0, Math.ceil((g.trip_date * 1000 - Date.now()) / 86_400_000));
                    return (
                      <a key={g.jar_pubkey} href={`/trip/${g.jar_pubkey}`}
                        className="block rounded-2xl border border-black/5 bg-[#FAFAF8] p-4 transition hover:-translate-y-0.5 hover:border-sol-purple hover:shadow-md">
                        <div className="flex items-start justify-between">
                          <div className="text-3xl">{g.destination_emoji}</div>
                          <span className="rounded-full bg-surface-sky px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                            {daysLeft > 0 ? `${daysLeft} days` : "Soon!"}
                          </span>
                        </div>
                        <div className="mt-2 font-display text-base font-semibold">{g.trip_name}</div>
                        <div className="text-xs text-ink-muted">{g.members.length} members · ${(g.budget_per_person_cents / 100).toLocaleString()}/person</div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/5">
                          <div className="h-full rounded-full bg-gradient-to-r from-sol-purple to-sol-blue" style={{ width: `${g.total_progress_pct}%` }} />
                        </div>
                        <div className="mt-1.5 flex justify-between text-[11px] text-ink-faint">
                          <span>{g.total_progress_pct}% raised</span>
                          <span>Open →</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Bottom grid: Activity | Schedules + Forecast */}
            {liveJars.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>

              {/* Recent Activity panel */}
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E2DC", borderRadius: 14, padding: "18px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Recent activity</div>
                {contributions.length === 0 ? (
                  <div style={{ padding: "32px 0", textAlign: "center", fontSize: 13, color: "#999999" }}>No activity yet — share your gift link 🎁</div>
                ) : (
                  <div>
                    {[...contributions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5).map((c) => {
                      const shortAddr = `${c.contributor.slice(0, 4)}…${c.contributor.slice(-4)}`;
                      const ago = (() => {
                        const s = Math.floor(Date.now() / 1000 - c.createdAt);
                        if (s < 3600) return `${Math.floor(s / 60)}m ago`;
                        if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
                        return `${Math.floor(s / 86400)}d ago`;
                      })();
                      return (
                        <div key={c.pubkey} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: "1px solid #E2E2DC" }}>
                          <div style={{ width: 30, height: 30, borderRadius: 8, background: "#F0F0EC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>💝</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{shortAddr} contributed</div>
                            <div style={{ fontSize: 11, color: "#999999" }}>{c.comment ? `"${c.comment.slice(0, 30)}" · ` : ""}{ago}</div>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: "#059669", flexShrink: 0 }}>+${(c.amount / 1_000_000).toFixed(2)}</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right column: schedules + forecast */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

                {/* Monthly reminders panel */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E2DC", borderRadius: 14, padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Monthly reminders</div>
                  {schedules.length === 0 ? (
                    <div style={{ fontSize: 12, color: "#999999", padding: "12px 0" }}>No reminders set up yet.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {schedules.map((s) => {
                        const nextDate = calcNextRun(s);
                        const nextLabel = nextDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
                        return (
                          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "#F0F0EC", borderRadius: 9 }}>
                            <div style={{ width: 30, height: 30, borderRadius: 8, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>🔔</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, fontWeight: 600 }}>{getJarName(s.jar_pubkey)}</div>
                              <div style={{ fontSize: 11, color: "#999999" }}>Next: {nextLabel}</div>
                            </div>
                            <div style={{ fontSize: 14, fontWeight: 700, flexShrink: 0 }}>${(s.amount_usdc / 100).toFixed(0)}/mo</div>
                            <button
                              onClick={() => onStopSchedule(s.id)}
                              style={{ fontSize: 10, color: "#999999", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)", marginLeft: 4 }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Portfolio forecast panel */}
                <div style={{ background: "#FFFFFF", border: "1px solid #E2E2DC", borderRadius: 14, padding: "18px 20px" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Portfolio forecast · 10 years</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {forecastScenarios.map((s) => {
                      const sel = scenario === s.monthly;
                      return (
                        <button
                          key={s.label}
                          onClick={() => setScenario(s.monthly)}
                          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderRadius: 9, border: sel ? "1px solid #059669" : "1px solid #E2E2DC", background: sel ? "#ECFDF5" : "#FFFFFF", cursor: "pointer", fontFamily: "var(--font)", transition: "all .15s" }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 500 }}>+{s.label} extra</span>
                          <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.5px", color: sel ? "#059669" : "#111111" }}>${s.value.toLocaleString()}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 11, color: "#999999", marginTop: 12, lineHeight: 1.5 }}>
                    Based on combined APY of {((apy.usdc_kamino + apy.sol_marinade) / 2).toFixed(1)}% across all jars. Not a guarantee.
                  </div>
                </div>

              </div>
            </div>}

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
  onBack,
}: {
  liveJars: JarType[];
  contributions: JarContribution[];
  apy: { usdc_kamino: number; sol_marinade: number };
  onMenuToggle: () => void;
  onBack: () => void;
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
        <button onClick={onBack} style={{ fontSize: 13, color: "#fff", background: "#111", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600 }}>
          ← Dashboard
        </button>
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
              No transactions yet. Share your gift link 🎁
            </div>
          ) : (
            <div className="space-y-1">
              {sortedContribs.map((c) => {
                const ago = (() => {
                  const s = Math.floor(Date.now() / 1000 - c.createdAt);
                  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
                  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
                  return `${Math.floor(s / 86400)}d ago`;
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
  onBack,
}: {
  contributions: JarContribution[];
  liveJars: JarType[];
  onMenuToggle: () => void;
  onBack: () => void;
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
        <button onClick={onBack} style={{ fontSize: 13, color: "#fff", background: "#111", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600 }}>
          ← Dashboard
        </button>
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
    recurring: { amount_usdc: number; frequency: "weekly" | "monthly"; day: number; hour: number; minute: number } | null;
    groupTrip: GroupTripParams | null;
    approvalMode: "NONE" | "FAMILY_APPROVAL";
  }) => Promise<void>;
  apy: { usdc_kamino: number; sol_marinade: number };
}) {
  const EMOJIS = ["🫙","🎯","✈️","🏖️","🏍️","🚗","🏡","👧","👶","🎓","💍","🎸","📱","💪","🌍","🎁","💰","🐕","🌱","🏋️"];

  const [selectedType, setSelectedType] = useState<JarTypeEnum | null>(null);
  const [guideQ1, setGuideQ1] = useState<"yes" | "no" | null>(null);
  const [step, setStep] = useState<StepName>("type");
  const [stepHistory, setStepHistory] = useState<StepName[]>([]);

  // Name
  const [jarName, setJarName] = useState("");
  const [jarEmoji, setJarEmoji] = useState("🫙");

  // Goal
  const [goalInput, setGoalInput] = useState("");

  // Date
  const [selectedYears, setSelectedYears] = useState<number | null>(5);
  const [customDate, setCustomDate] = useState("");

  // Reminder
  const [reminderChoice, setReminderChoice] = useState<"monthly" | "none">("none");
  const [reminderAmount, setReminderAmount] = useState("100");

  // Security
  const [approvalMode, setApprovalMode] = useState<"NONE" | "FAMILY_APPROVAL">("NONE");

  const [submitting, setSubmitting] = useState(false);

  const { publicKey } = useWallet();
  const walletConnected = !!publicKey;

  // ── Derived values ──
  const goalUsd = parseFloat(goalInput) || 0;
  const hasGoal = goalUsd > 0;
  const hasDate = !!(selectedYears || customDate);
  const isReminder = reminderChoice === "monthly";
  const monthly = isReminder ? (parseFloat(reminderAmount) || 100) : 0;

  const years = selectedYears ?? (customDate
    ? Math.max(1, Math.round((new Date(customDate).getTime() - Date.now()) / (365.25 * 86400 * 1000)))
    : 5);

  const r12 = 0.055 / 12;
  const monthsToGoal = (hasGoal && isReminder && monthly > 0)
    ? Math.ceil(Math.log(goalUsd * r12 / monthly + 1) / Math.log(1 + r12))
    : null;
  const effectiveYears = hasDate ? years : monthsToGoal ? monthsToGoal / 12 : 5;
  const nMonths = Math.round(effectiveYears * 12);

  const projJarfi = isReminder && monthly > 0
    ? Math.round(monthly * ((Math.pow(1 + r12, nMonths) - 1) / r12))
    : 0;
  const projBank = isReminder && monthly > 0
    ? Math.round(monthly * ((Math.pow(1 + 0.02 / 12, nMonths) - 1) / (0.02 / 12)))
    : 0;

  // ── Suggested reminder amount for GOAL_BY_DATE ──
  const suggestedMonthly = (selectedType === "GOAL_BY_DATE" && hasGoal && hasDate && years > 0)
    ? Math.ceil(goalUsd / (years * 12))
    : null;

  // ── Step flows ──
  const typeSteps: StepName[] = selectedType ? STEP_FLOWS[selectedType] : [];

  function goTo(s: StepName) {
    setStepHistory(h => [...h, step]);
    setStep(s);
  }

  function goBack() {
    const prev = stepHistory[stepHistory.length - 1];
    if (prev) {
      setStepHistory(h => h.slice(0, -1));
      setStep(prev);
    } else {
      if (step !== "type") { setStep("type"); setSelectedType(null); }
      else onClose();
    }
  }

  function selectType(t: JarTypeEnum) {
    setSelectedType(t);
    setStepHistory(["type"]);
    setStep(STEP_FLOWS[t][0]);
  }

  function advanceStep() {
    const idx = typeSteps.indexOf(step);
    if (idx < typeSteps.length - 1) goTo(typeSteps[idx + 1]);
  }

  // Review unlock date
  const unlockDateForReview = customDate
    ? Math.floor(new Date(customDate).getTime() / 1000)
    : selectedYears
    ? Math.floor(Date.now() / 1000 + selectedYears * 365.25 * 86400)
    : 0;
  const unlockDateStr = unlockDateForReview > 1
    ? new Date(unlockDateForReview * 1000).toLocaleDateString("en-US", { year: "numeric", month: "long" })
    : null;

  // ── Create ──
  async function handleCreate() {
    if (!selectedType) return;
    // GoalAmountRequired (6010): goal-based jars must have a non-zero amount
    if ((selectedType === "GOAL" || selectedType === "GOAL_BY_DATE") && goalUsd <= 0) return;
    setSubmitting(true);
    try {
      const unlockDate = customDate
        ? Math.floor(new Date(customDate).getTime() / 1000)
        : selectedYears
        ? Math.floor(Date.now() / 1000 + selectedYears * 365.25 * 86400)
        : 0;
      const goalAmount = goalUsd > 0 ? Math.round(goalUsd * 1_000_000) : 0;
      const { mode, contractUnlockDate, contractGoal } = jarTypeToContract(selectedType, unlockDate, goalAmount);

      const recurring = isReminder && monthly > 0
        ? { amount_usdc: Math.round(monthly * 100), frequency: "monthly" as const, day: 1, hour: 9, minute: 0 }
        : null;

      await onCreate({ jarName, jarEmoji, mode, unlockDate: contractUnlockDate, goalAmount: contractGoal, currency: "usdc", recurring, groupTrip: null, approvalMode });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Total steps indicator ──
  const allSteps: StepName[] = ["type", ...typeSteps];
  const currentIdx = allSteps.indexOf(step);

  // suppress unused warning
  void guideQ1;
  void apy;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.4)", padding: 24, backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 520, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 20, padding: 40, maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress dots */}
        {selectedType && (
          <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginBottom: 36 }}>
            {allSteps.map((s, i) => (
              <div key={s} style={{
                height: 4, borderRadius: 2,
                width: i === currentIdx ? 24 : 8,
                background: i < currentIdx ? "var(--green)" : i === currentIdx ? "var(--text-primary)" : "var(--border)",
                transition: "all 0.3s",
              }} />
            ))}
          </div>
        )}

        {/* ── STEP: type ── */}
        {step === "type" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px", marginBottom: 8 }}>What kind of jar?</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Choose the type that fits your goal best.</div>
            </div>
            {(["GOAL", "DATE", "GOAL_BY_DATE", "SHARED"] as JarTypeEnum[]).map((t) => (
              <button key={t} onClick={() => selectType(t)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", background: "var(--bg)", fontFamily: "var(--font)", textAlign: "left", transition: "border-color 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "var(--text-primary)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                <span style={{ fontSize: 24, width: 36, textAlign: "center" }}>{JAR_TYPE_ICONS[t]}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>{JAR_TYPE_LABELS[t]}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{JAR_TYPE_DESCRIPTIONS[t]}</div>
                </div>
              </button>
            ))}
            <button onClick={() => { setStepHistory(["type"]); setStep("guide"); }}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", background: "var(--bg)", fontFamily: "var(--font)", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "var(--text-primary)"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "var(--border)"}
            >
              <span style={{ fontSize: 24, width: 36, textAlign: "center" }}>💡</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>Guide me</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Answer a few questions and Jarfi will suggest the best setup.</div>
              </div>
            </button>
          </div>
        )}

        {/* ── STEP: guide ── */}
        {step === "guide" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>Let&apos;s find the right jar</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>Is there a specific amount you&apos;re saving for?</div>
            </div>
            {[
              { val: "yes" as const, icon: "🎯", title: "Yes — I have a target amount", desc: "e.g. $5,000 for a car" },
              { val: "no"  as const, icon: "📅", title: "No — saving until a date or collecting", desc: "e.g. birthday fund, child savings" },
            ].map(o => (
              <button key={o.val} onClick={() => {
                setGuideQ1(o.val);
                if (o.val === "yes") {
                  setGuideQ1("yes");
                  selectType("GOAL");
                } else {
                  selectType("SHARED");
                }
              }}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: "1px solid var(--border)", borderRadius: 12, cursor: "pointer", background: "var(--bg)", fontFamily: "var(--font)", textAlign: "left" }}>
                <span style={{ fontSize: 22, width: 36, textAlign: "center" }}>{o.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{o.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{o.desc}</div>
                </div>
              </button>
            ))}
            <FlowNav onBack={goBack} />
          </div>
        )}

        {/* ── STEP: name ── */}
        {step === "name" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                {selectedType && `${JAR_TYPE_ICONS[selectedType]} ${JAR_TYPE_LABELS[selectedType]}`}
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>What are you saving for?</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>Give your jar a name — it&apos;ll appear on the gift link you share.</div>
            </div>
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  style={{ height: 44, width: 44, flexShrink: 0, borderRadius: 8, border: "1px solid var(--border)", background: "var(--bg)", fontSize: 22, cursor: "pointer" }}
                  onClick={() => { const i = EMOJIS.indexOf(jarEmoji); setJarEmoji(EMOJIS[(i + 1) % EMOJIS.length]); }}
                >{jarEmoji}</button>
                <input
                  autoFocus
                  placeholder={selectedType === "SHARED" ? "e.g. Birthday Collection" : selectedType === "DATE" ? "e.g. Eva's 18th Birthday" : "e.g. Japan Trip"}
                  value={jarName}
                  onChange={(e) => setJarName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && jarName.trim() && advanceStep()}
                  style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 17, fontFamily: "var(--font)", outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => setJarEmoji(e)} style={{ height: 36, width: 36, borderRadius: 8, fontSize: 18, cursor: "pointer", border: "1px solid", borderColor: jarEmoji === e ? "var(--text-primary)" : "var(--border)", background: jarEmoji === e ? "var(--bg-muted)" : "var(--bg)" }}>{e}</button>
                ))}
              </div>
            </div>
            <FlowNav onBack={goBack} onNext={advanceStep} nextDisabled={!jarName.trim()} />
          </div>
        )}

        {/* ── STEP: goal ── */}
        {step === "goal" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                {selectedType && `${JAR_TYPE_ICONS[selectedType]} ${JAR_TYPE_LABELS[selectedType]}`}
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>
                {selectedType === "SHARED" ? "Add a goal? (optional)" : "What's your target amount?"}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
                {selectedType === "SHARED"
                  ? "Optional. Leave empty if you just want to collect contributions."
                  : "Set the amount you want to reach."}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15, fontWeight: 600, background: "var(--bg-muted)", color: "var(--text-secondary)", minWidth: 48, textAlign: "center" }}>$</div>
              <input
                autoFocus
                type="number"
                placeholder={selectedType === "SHARED" ? "Optional" : "10,000"}
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && advanceStep()}
                style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none" }}
              />
            </div>
            <FlowNav
              onBack={goBack}
              onNext={advanceStep}
              nextDisabled={selectedType !== "SHARED" && !goalInput}
              nextLabel={selectedType === "SHARED" && !goalInput ? "Skip" : "Continue"}
            />
          </div>
        )}

        {/* ── STEP: date ── */}
        {step === "date" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                {selectedType && `${JAR_TYPE_ICONS[selectedType]} ${JAR_TYPE_LABELS[selectedType]}`}
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>
                {selectedType === "SHARED" ? "Add an event date? (optional)" : "When do you need it?"}
              </div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
                {selectedType === "DATE" && "Funds stay locked until this date, earning yield automatically."}
                {selectedType === "GOAL_BY_DATE" && "Jar unlocks when the goal is reached OR this date arrives — whichever comes first."}
                {selectedType === "GOAL" && "Optional planning date. Does not lock the jar by date."}
                {selectedType === "SHARED" && "Optional. Useful to show an event deadline on the contribution page."}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {[1, 3, 5, 10, 18, 0].map((y) => {
                const isNone = y === 0;
                const active = isNone ? (selectedYears === null && !customDate) : selectedYears === y;
                return (
                  <button key={y} onClick={() => { setSelectedYears(isNone ? null : y); setCustomDate(""); }}
                    style={{ padding: 12, border: "1px solid", borderColor: active ? "var(--text-primary)" : "var(--border)", borderRadius: 8, cursor: "pointer", background: active ? "var(--bg-muted)" : "var(--bg)", fontFamily: "var(--font)", textAlign: "center" }}>
                    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.5px" }}>{isNone ? "—" : y}</div>
                    <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 2 }}>
                      {isNone ? (selectedType === "DATE" || selectedType === "GOAL_BY_DATE" ? "required" : "no date") : y === 1 ? "year" : "years"}
                    </div>
                  </button>
                );
              })}
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
            <FlowNav
              onBack={goBack}
              onNext={advanceStep}
              nextDisabled={(selectedType === "DATE" || selectedType === "GOAL_BY_DATE") && !hasDate}
              nextLabel={selectedType === "GOAL" || selectedType === "SHARED" ? (hasDate ? "Continue" : "Skip") : "Continue"}
            />
          </div>
        )}

        {/* ── STEP: reminder ── */}
        {step === "reminder" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                {selectedType && `${JAR_TYPE_ICONS[selectedType]} ${JAR_TYPE_LABELS[selectedType]}`}
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>Monthly contribution reminder</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6, marginTop: 6 }}>
                Jarfi can remind you to add money each month. You approve every payment from your wallet — nothing is charged automatically.
              </div>
            </div>

            {/* GOAL_BY_DATE: show suggested amount */}
            {selectedType === "GOAL_BY_DATE" && suggestedMonthly && (
              <div style={{ padding: "12px 14px", background: "#ECFDF5", borderRadius: 10, fontSize: 13, color: "#059669" }}>
                💡 To reach ${goalUsd.toLocaleString()} by {unlockDateStr ?? `${years} years`}, you need about <strong>${suggestedMonthly}/month</strong>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { val: "monthly" as const, icon: "🔔", title: "Yes — remind me monthly", desc: "You approve each payment from your wallet" },
                { val: "none"    as const, icon: "⏭️", title: "No reminders", desc: "I'll add funds manually when I want" },
              ].map(o => (
                <button key={o.val} onClick={() => setReminderChoice(o.val)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: "1px solid", borderColor: reminderChoice === o.val ? "var(--text-primary)" : "var(--border)", borderRadius: 12, cursor: "pointer", background: reminderChoice === o.val ? "var(--bg-muted)" : "var(--bg)", fontFamily: "var(--font)", textAlign: "left" }}>
                  <span style={{ fontSize: 22, width: 36, textAlign: "center" }}>{o.icon}</span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{o.title}</div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{o.desc}</div>
                  </div>
                </button>
              ))}
            </div>
            {reminderChoice === "monthly" && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Monthly amount</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <div style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15, fontWeight: 600, background: "var(--bg-muted)", color: "var(--text-secondary)", minWidth: 48, textAlign: "center" }}>$</div>
                  <input type="number"
                    value={suggestedMonthly && !reminderAmount ? String(suggestedMonthly) : reminderAmount}
                    onChange={(e) => setReminderAmount(e.target.value)}
                    style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none" }}
                  />
                </div>
              </div>
            )}
            <FlowNav onBack={goBack} onNext={advanceStep} />
          </div>
        )}

        {/* ── STEP: security ── */}
        {step === "security" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                {selectedType && `${JAR_TYPE_ICONS[selectedType]} ${JAR_TYPE_LABELS[selectedType]}`}
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>Who can unlock this jar?</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
                Family approval is recommended for long-term and child savings jars.
              </div>
            </div>
            {[
              { val: "NONE" as const,            icon: "🔑", title: "Just me", desc: "You can withdraw when jar conditions are met." },
              { val: "FAMILY_APPROVAL" as const, icon: "👨‍👩‍👧", title: "Family approval (recommended)", desc: "Protected by 2-of-2 family approval. Co-signers approve withdrawals." },
            ].map(o => (
              <button key={o.val} onClick={() => setApprovalMode(o.val)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: "1px solid", borderColor: approvalMode === o.val ? "var(--text-primary)" : "var(--border)", borderRadius: 12, cursor: "pointer", background: approvalMode === o.val ? "var(--bg-muted)" : "var(--bg)", fontFamily: "var(--font)", textAlign: "left" }}>
                <span style={{ fontSize: 22, width: 36, textAlign: "center" }}>{o.icon}</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{o.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{o.desc}</div>
                </div>
              </button>
            ))}
            {approvalMode === "FAMILY_APPROVAL" && (
              <div style={{ padding: "12px 14px", background: "#ECFDF5", borderRadius: 10, fontSize: 13, color: "#059669" }}>
                👨‍👩‍👧 After creating the jar, you&apos;ll get an invite link to share with your co-signer. They connect their wallet to activate approval. <span style={{ color: "#555", display: "block", marginTop: 4 }}>Note: co-signers can only approve withdrawals — they cannot edit jar settings.</span>
              </div>
            )}
            <FlowNav onBack={goBack} onNext={advanceStep} />
          </div>
        )}

        {/* ── STEP: review ── */}
        {step === "review" && selectedType && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>Review</div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>Ready to create?</div>
            </div>

            {/* Summary card */}
            <div style={{ background: "var(--bg-muted)", borderRadius: 12, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 28 }}>{jarEmoji}</span>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 600 }}>{jarName || "Untitled jar"}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                    {JAR_TYPE_ICONS[selectedType]} {JAR_TYPE_LABELS[selectedType]}
                  </div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                {hasGoal && (
                  <ReviewRow label="Goal" value={`$${goalUsd.toLocaleString()}`} />
                )}
                {unlockDateStr && selectedType !== "SHARED" && (
                  <ReviewRow label="Unlock date" value={unlockDateStr} />
                )}
                <ReviewRow
                  label="Unlock rule"
                  value={UNLOCK_RULE_LABEL[unlockRuleForType(selectedType)]}
                />
                <ReviewRow
                  label="Monthly reminders"
                  value={isReminder ? `$${monthly}/month` : "Off"}
                />
                {approvalMode === "FAMILY_APPROVAL" && (
                  <ReviewRow label="Approval" value="👨‍👩‍👧 2-of-2 family approval" />
                )}
                <ReviewRow label="Yield" value="~5.5% APY via Kamino (USDC)" />
              </div>
            </div>

            {/* Projection */}
            {projJarfi > 0 && (
              <div style={{ padding: "14px 16px", background: "#ECFDF5", borderRadius: 10, display: "flex", flexDirection: "column", gap: 4 }}>
                {monthsToGoal && !hasDate ? (
                  <>
                    <div style={{ fontSize: 12, color: "#059669" }}>Time to reach goal at ${monthly}/month</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#059669" }}>
                      ~{monthsToGoal < 24 ? `${monthsToGoal} months` : `${Math.round(monthsToGoal / 12)} years`}
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 12, color: "#059669" }}>Estimated value in {Math.round(effectiveYears)} years</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#059669" }}>${projJarfi.toLocaleString()}</div>
                    <div style={{ fontSize: 12, color: "#555" }}>vs ${projBank.toLocaleString()} in a bank account</div>
                  </>
                )}
              </div>
            )}

            {walletConnected ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: "#f0faf5", borderRadius: 8, fontSize: 13, color: "var(--green)" }}>
                <span>✓</span><span>Wallet connected — ready to create</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "var(--bg-muted)", borderRadius: 8, fontSize: 13, color: "var(--text-secondary)" }}>
                <span>🔐</span><span>Connect a wallet to create your jar.</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={goBack} style={{ fontSize: 14, color: "var(--text-secondary)", cursor: "pointer", padding: "13px 0", border: "none", background: "none", fontFamily: "var(--font)" }}>Back</button>
              {walletConnected ? (
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  style={{ flex: 1, background: "var(--green)", color: "#fff", fontSize: 15, fontWeight: 500, padding: "13px 20px", borderRadius: 8, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Creating…" : "Create jar"}
                </button>
              ) : (
                <div style={{ flex: 1 }}><WalletButton /></div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 500, color: "var(--text-primary)", maxWidth: "60%", textAlign: "right" }}>{value}</span>
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
        display: "flex", alignItems: "center", gap: 9, width: "100%",
        padding: "8px 10px", borderRadius: 9,
        background: active ? "#ECFDF5" : "transparent",
        color: active ? "#059669" : "#555555",
        fontWeight: active ? 600 : 400, fontSize: 13,
        cursor: "pointer", border: "none", fontFamily: "var(--font)",
        textAlign: "left", transition: "all 0.15s",
      }}
    >
      <span style={{ width: 18, textAlign: "center", fontSize: 14 }}>{icon}</span>
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

// ---------------------------------------------------------------------------
// JAR DETAIL PANEL
// ---------------------------------------------------------------------------

function JarDetailPanel({
  jar,
  apy,
  schedules,
  onBack,
  onMenuToggle,
  onAddFunds,
  onScheduleUpdate,
  onJarBroken,
}: {
  jar: JarType;
  apy: { usdc_kamino: number; sol_marinade: number };
  schedules: Schedule[];
  onBack: () => void;
  onMenuToggle: () => void;
  onAddFunds: (pubkey: string, name: string, currency: "usdc" | "sol") => void;
  onScheduleUpdate: (schedules: Schedule[]) => void;
  onJarBroken: (pubkey: string) => void;
}) {
  const { connection } = useConnection();
  const { wallet, publicKey } = useWallet();
  const [contribs, setContribs] = useState<JarContribution[]>([]);
  const [copied, setCopied] = useState(false);
  const [cosigners, setCosigners] = useState<Cosigner[]>([]);
  const [editSchedule, setEditSchedule] = useState<Schedule | null>(null);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [breaking, setBreaking] = useState(false);
  const [breakToast, setBreakToast] = useState<string | null>(null);
  const [breakResult, setBreakResult] = useState<{ txSignature: string; amount: number; currency: "usdc" | "sol"; walletAddr: string } | null>(null);

  const showLocalToast = (msg: string) => {
    setBreakToast(msg);
    setTimeout(() => setBreakToast(null), 3500);
  };

  const handleBreakJar = async () => {
    if (!wallet?.adapter || !publicKey) return;
    setBreaking(true);
    try {
      const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app";
      let txSignature: string | null = null;

      // Always fetch live balance from chain — cache may be stale after deposits
      const { fetchJarByPubkey: fetchLive } = await import("@/lib/program");
      const liveJar = await fetchLive(connection, new (await import("@solana/web3.js")).PublicKey(jar.id)).catch(() => null);
      const isUsdc = jar.currency === "usdc";
      const liveAmount = liveJar
        ? (isUsdc ? liveJar.usdcBalance / 1_000_000 : liveJar.balance / 1_000_000_000)
        : jar.amount;

      if (liveAmount <= 0) {
        // Empty jar — no on-chain withdrawal needed, just clean up
        txSignature = null;
      } else {
        const microUnits = Math.round(liveAmount * 1_000_000);
        txSignature = await breakUsdcJarOnChain(wallet.adapter as never, connection, jar.id, microUnits);
      }

      fetch(`${BACKEND}/jar/meta/${jar.id}`, { method: "DELETE" }).catch(() => {});
      setShowBreakModal(false);
      setBreakResult({
        txSignature: txSignature ?? "",
        amount: liveAmount,
        currency: jar.currency,
        walletAddr: publicKey.toBase58(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      showLocalToast("Failed: " + msg.slice(0, 120));
      setBreaking(false);
      setShowBreakModal(false);
    }
  };

  const jarSchedule = schedules.find(s => s.jar_pubkey === jar.id) ?? null;

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app";
  const [slug, setSlug] = useState<string | null>(() => getJarSlug(jar.id));
  const giftPath = slug ?? jar.id;
  const giftUrl = `jarfi.xyz/gift/${giftPath}`;
  const giftFullUrl = `https://jarfi.xyz/gift/${giftPath}`;

  useEffect(() => {
    if (!wallet?.adapter) return;
    fetchContributionsForJar(jar.id).then(setContribs).catch(() => {});
    fetchCosigners(jar.id).then(setCosigners).catch(() => {});
    // Ensure slug is stored — fetch from backend if not in localStorage
    if (!getJarSlug(jar.id)) {
      fetch(`${BACKEND}/jar/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubkey: jar.id, name: jar.name, emoji: jar.emoji }),
      })
        .then(r => r.json())
        .then(d => { if (d.share_slug) { saveJarSlug(jar.id, d.share_slug); setSlug(d.share_slug); } })
        .catch(() => {});
    }
  }, [jar.id, wallet?.adapter, BACKEND]);

  const isUsdc   = jar.currency === "usdc";
  const apr      = isUsdc ? apy.usdc_kamino / 100 : apy.sol_marinade / 100;
  const future   = jar.futureValue ?? jar.amount;
  const pct      = Math.min(100, Math.round((jar.amount / Math.max(jar.goal, 0.01)) * 100));
  const monthlyYield = jar.amount * apr / 12;
  const yearsLeft    = jar.unlockDate > 0 ? Math.max(0, (jar.unlockDate - Date.now() / 1000) / (365.25 * 86400)) : 10;
  const unlockStr    = jar.unlockDate > 0 ? new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", { year: "numeric", month: "short" }) : null;

  const fmt  = (n: number) => isUsdc ? `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `◎${n.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  const fmtK = (n: number) => isUsdc ? `$${Math.round(n).toLocaleString()}` : `◎${n.toFixed(2)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(giftFullUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <TopBar title={`${jar.emoji} ${jar.name}`} onMenuToggle={onMenuToggle} onBack={onBack} />

      <div style={{ padding: "40px 48px", maxWidth: 1100, margin: "0 auto" }} className="jar-detail-wrap">
        <div className="jar-detail-grid" style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 48, alignItems: "start" }}>

          {/* ── LEFT ── */}
          <div>
            {/* Multisig badge */}
            {cosigners.some(c => c.status === "active") && (
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#EDE9FE", color: "#6D28D9", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 600, marginBottom: 20 }}>
                🔐 Multisig · 2-of-2
              </div>
            )}

            {/* Balance / Future value */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: 60, fontWeight: 600, letterSpacing: "-2.5px", lineHeight: 1, color: jar.unlockDate > 0 ? "var(--green)" : "var(--text-primary)" }}>
                {jar.unlockDate > 0 ? fmtK(future) : fmt(jar.amount)}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
                {jar.unlockDate > 0 ? (
                  <>
                    Estimated future value
                    <span title="Projected value based on current savings and yield" style={{ width: 14, height: 14, borderRadius: "50%", border: "1px solid var(--text-tertiary)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, cursor: "help" }}>?</span>
                  </>
                ) : "Current balance"}
              </div>
              <div style={{ display: "flex", gap: 32, marginTop: 20 }}>
                {[
                  { num: fmt(jar.amount), label: "Saved so far" },
                  { num: jar.goal > 0 ? fmt(jar.goal) : "—", label: "Goal" },
                  { num: String(contribs.length), label: "Contributors" },
                ].map(v => (
                  <div key={v.label}>
                    <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.8px" }}>{v.num}</div>
                    <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>{v.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Progress */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 10 }}>
                <span><strong style={{ color: "var(--text-primary)" }}>{pct}%</strong> of goal reached</span>
                {jar.goal > 0 && <span>{fmt(Math.max(0, jar.goal - jar.amount))} remaining</span>}
              </div>
              <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--green)", borderRadius: 4 }} />
              </div>
            </div>

            {/* Yield block */}
            <div style={{ background: "var(--bg-muted)", borderRadius: 16, padding: 24, marginBottom: 32 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12 }}>
                Staking yield
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600, color: "var(--green)", letterSpacing: "-0.5px" }}>{isUsdc ? apy.usdc_kamino : apy.sol_marinade}%</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Current APY</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px" }}>{fmt(monthlyYield)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Est. monthly earnings</div>
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px" }}>{isUsdc ? "Kamino" : "Marinade"}</div>
                  <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2 }}>Protocol</div>
                </div>
              </div>
            </div>

            {/* Projection */}
            {unlockStr && (
              <div style={{ background: "var(--bg-muted)", borderRadius: 16, padding: 24, marginBottom: 32 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10 }}>
                  If you keep going
                </div>
                <div style={{ fontSize: 20, fontWeight: 500, letterSpacing: "-0.5px", marginBottom: 4 }}>
                  You&apos;ll have <strong style={{ color: "var(--green)" }}>{fmtK(future)}</strong> by {unlockStr}
                </div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>
                  This includes your contributions and {isUsdc ? `Kamino ${apy.usdc_kamino}%` : `Marinade ${apy.sol_marinade}%`} yield.
                </div>
              </div>
            )}

            {/* Contributors */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 500 }}>Contributors</div>
                <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{contribs.length} {contribs.length === 1 ? "person" : "people"}</div>
              </div>
              {contribs.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-tertiary)", padding: "24px 0" }}>No contributions yet — share your gift link!</div>
              ) : (
                contribs.slice(0, 10).map((c) => {
                  const short = `${c.contributor.slice(0, 6)}…${c.contributor.slice(-4)}`;
                  const ago = (() => {
                    const s = Math.floor(Date.now() / 1000 - c.createdAt);
                    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
                    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
                    return new Date(c.createdAt * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
                  })();
                  return (
                    <div key={c.pubkey} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-muted)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                        {short.slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{short}</div>
                        {c.comment && <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>&quot;{c.comment.slice(0, 60)}&quot;</div>}
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 14, fontWeight: 600 }}>+{fmt(c.amount / 1_000_000)}</div>
                        <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>{ago}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ── RIGHT — share panel ── */}
          <div style={{ position: "sticky", top: 24 }}>
            <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 16, padding: 28, marginBottom: 16 }}>
              {/* Add funds */}
              <button
                onClick={() => onAddFunds(jar.id, jar.name, jar.currency as "usdc" | "sol")}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "11px 0", background: "#111111", color: "#fff", borderRadius: 9, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "var(--font)", marginBottom: 20 }}
              >
                + Add funds
              </button>

              {/* Share */}
              <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 4 }}>Share this jar</div>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>{jar.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
                Anyone with this link can contribute — no crypto needed.
              </div>
              <div style={{ background: "var(--bg-muted)", borderRadius: 8, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{giftUrl}</span>
                <button onClick={handleCopy} style={{ fontSize: 12, fontWeight: 600, color: "var(--green)", cursor: "pointer", border: "none", background: "none", fontFamily: "var(--font)", whiteSpace: "nowrap" }}>
                  {copied ? "Copied!" : "Copy link"}
                </button>
              </div>
              <a href={giftFullUrl} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", padding: "10px 0", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, fontWeight: 500, color: "var(--text-primary)", textDecoration: "none", marginBottom: 12 }}>
                Open gift page →
              </a>

              {/* Share buttons */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
                {[
                  {
                    label: "WhatsApp",
                    emoji: "💬",
                    color: "#25D366",
                    href: `https://wa.me/?text=${encodeURIComponent(`Help me save for ${jar.name} 🏺 Contribute in seconds with a card or Apple Pay — no crypto needed!\n${giftFullUrl}`)}`,
                  },
                  {
                    label: "Twitter",
                    emoji: "𝕏",
                    color: "#000",
                    href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(`Help me save for ${jar.name} 🏺 Contribute in seconds with a card or Apple Pay — no crypto needed!`)}&url=${encodeURIComponent(giftFullUrl)}`,
                  },
                  {
                    label: "Telegram",
                    emoji: "✈️",
                    color: "#229ED9",
                    href: `https://t.me/share/url?url=${encodeURIComponent(giftFullUrl)}&text=${encodeURIComponent(`Help me save for ${jar.name} 🏺 Contribute with a card — no crypto needed!`)}`,
                  },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "9px 4px", border: "1px solid var(--border)", borderRadius: 8, textDecoration: "none", transition: "border-color .15s" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = s.color)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
                  >
                    <span style={{ fontSize: 16 }}>{s.emoji}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>{s.label}</span>
                  </a>
                ))}
              </div>

              <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />

              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 14 }}>Jar details</div>
              {[
                { label: "Status",    value: jar.locked ? "🔒 Locked" : "🟢 Open", green: !jar.locked },
                { label: "Unlocks",  value: unlockStr ?? "No date set" },
                { label: "Network",  value: "Solana" },
                { label: "Currency", value: isUsdc ? "USDC" : "SOL" },
                { label: "Yield",    value: `${isUsdc ? apy.usdc_kamino : apy.sol_marinade}% APY via ${isUsdc ? "Kamino" : "Marinade"}` },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{s.label}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: s.green ? "var(--green)" : "var(--text-primary)" }}>{s.value}</span>
                </div>
              ))}

              {/* Monthly reminder section */}
              {jarSchedule && (
                <>
                  <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>Monthly reminder</div>
                    <button
                      onClick={() => setEditSchedule(jarSchedule)}
                      style={{ fontSize: 11, color: "var(--text-secondary)", background: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "3px 9px", cursor: "pointer", fontFamily: "var(--font)" }}
                    >
                      Edit plan
                    </button>
                  </div>
                  {[
                    { label: "Amount", value: `$${(jarSchedule.amount_usdc / 100).toFixed(0)}/month` },
                    { label: "Next reminder", value: calcNextRun(jarSchedule).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
                    { label: "Frequency", value: jarSchedule.frequency === "monthly" ? `Every ${jarSchedule.day}${jarSchedule.day === 1 ? "st" : jarSchedule.day === 2 ? "nd" : jarSchedule.day === 3 ? "rd" : "th"}` : "Weekly" },
                  ].map(r => (
                    <div key={r.label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{r.label}</span>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{r.value}</span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "#999", marginTop: 4, lineHeight: 1.5 }}>
                    You approve every payment — nothing is charged automatically.
                  </div>
                </>
              )}

              {/* Cosigners section */}
              {cosigners.length > 0 && (
                <>
                  <div style={{ height: 1, background: "var(--border)", margin: "20px 0" }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>Multisig approval</span>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: cosigners.some(c => c.status === "active") ? "#EDE9FE" : "#FEF3C7", color: cosigners.some(c => c.status === "active") ? "#6D28D9" : "#92400E" }}>
                      {cosigners.some(c => c.status === "active") ? "🔐 Active" : "⏳ Pending"}
                    </span>
                  </div>
                  {cosigners.map(c => (
                    <div key={c.invite_token} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                        {c.invitee_pubkey ? `${c.invitee_pubkey.slice(0, 4)}…${c.invitee_pubkey.slice(-4)}` : "Invite sent"}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: c.status === "active" ? "#ECFDF5" : "#FEF3C7", color: c.status === "active" ? "#059669" : "#92400E" }}>
                        {c.status === "active" ? "Active" : "Pending"}
                      </span>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: "#999", marginTop: 4 }}>
                    Soft approval · on-chain enforcement coming soon
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Break jar */}
          <div style={{ marginTop: 16 }}>
            <button
              onClick={() => setShowBreakModal(true)}
              style={{ width: "100%", padding: "10px 0", background: "none", border: "1px solid #FCA5A5", borderRadius: 9, color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
            >
              🔨 Break jar & withdraw funds
            </button>
          </div>

          {/* Break jar modal */}
          {showBreakModal && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div style={{ background: "#fff", borderRadius: 20, padding: 32, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>🔨 Break this jar?</div>
                <div style={{ fontSize: 14, color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.5 }}>
                  This will withdraw all funds back to your wallet. This action cannot be undone.
                </div>

                <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#DC2626", marginBottom: 8 }}>Funds to be withdrawn</div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: "#111", letterSpacing: "-1px" }}>
                    {jar.currency === "usdc"
                      ? `$${jar.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDC`
                      : `◎${jar.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })} SOL`}
                  </div>
                  <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                    → {publicKey ? `${publicKey.toBase58().slice(0, 6)}…${publicKey.toBase58().slice(-4)}` : "your wallet"}
                  </div>
                </div>

                {cosigners.some(c => c.status === "active") && (
                  <div style={{ background: "#F5F3FF", border: "1px solid #C4B5FD", borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#6D28D9", marginBottom: 8 }}>🔐 Multisig jar — equal split (informational)</div>
                    {[publicKey?.toBase58(), ...cosigners.filter(c => c.status === "active").map(c => c.invitee_pubkey)].filter(Boolean).map((addr, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--text-secondary)", marginBottom: 4 }}>
                        <span>{addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—"}</span>
                        <span style={{ fontWeight: 600 }}>
                          {jar.currency === "usdc"
                            ? `$${(jar.amount / ([publicKey, ...cosigners.filter(c => c.status === "active")].length)).toFixed(2)}`
                            : `◎${(jar.amount / ([publicKey, ...cosigners.filter(c => c.status === "active")].length)).toFixed(4)}`}
                        </span>
                      </div>
                    ))}
                    <div style={{ fontSize: 11, color: "#999", marginTop: 6 }}>
                      Funds go to jar owner on-chain. Transfer to co-signers manually after withdrawal.
                    </div>
                  </div>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => setShowBreakModal(false)}
                    disabled={breaking}
                    style={{ flex: 1, padding: "12px 0", background: "none", border: "1px solid var(--border)", borderRadius: 9, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", fontFamily: "var(--font)" }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBreakJar}
                    disabled={breaking}
                    style={{ flex: 1, padding: "12px 0", background: "#DC2626", border: "none", borderRadius: 9, fontSize: 14, fontWeight: 600, color: "#fff", cursor: breaking ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: breaking ? 0.7 : 1 }}
                  >
                    {breaking ? "Withdrawing…" : "Break & withdraw"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Local toast for break jar errors */}
          {breakToast && (
            <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 300, borderRadius: 9999, background: "#111", color: "#fff", padding: "12px 20px", fontSize: 14, fontWeight: 500, boxShadow: "0 8px 24px rgba(0,0,0,.2)" }}>
              {breakToast}
            </div>
          )}

          {/* Break jar success screen */}
          {breakResult && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
              <div style={{ background: "#fff", borderRadius: 24, padding: 36, maxWidth: 420, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,.18)", textAlign: "center" }}>
                {/* Icon */}
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, margin: "0 auto 20px" }}>
                  ✅
                </div>

                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>
                  {breakResult.amount > 0 ? "Funds on the way!" : "Jar removed!"}
                </div>
                <div style={{ fontSize: 14, color: "#6B7280", marginBottom: 28, lineHeight: 1.5 }}>
                  {breakResult.amount > 0
                    ? "Your jar has been broken. Funds were sent to your wallet."
                    : "Empty jar removed from your dashboard."}
                </div>

                {/* Amount block */}
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 16, padding: 20, marginBottom: 16, textAlign: "left" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#059669", marginBottom: 6 }}>
                    {breakResult.amount > 0 ? "Amount received" : "Balance"}
                  </div>
                  <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-1.5px", color: "#111" }}>
                    {breakResult.currency === "usdc"
                      ? `$${breakResult.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : `◎${breakResult.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}`}
                    <span style={{ fontSize: 16, fontWeight: 500, color: "#6B7280", marginLeft: 6 }}>
                      {breakResult.currency.toUpperCase()}
                    </span>
                  </div>
                  {breakResult.amount > 0 && (
                    <div style={{ fontSize: 12, color: "#6B7280", marginTop: 10 }}>
                      Wallet: <span style={{ fontWeight: 600, color: "#111", fontFamily: "monospace" }}>
                        {breakResult.walletAddr.slice(0, 6)}…{breakResult.walletAddr.slice(-4)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Transaction — only shown if there was one */}
                {breakResult.txSignature && (
                  <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14, marginBottom: 24, textAlign: "left" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "#9CA3AF", marginBottom: 6 }}>Transaction</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontSize: 12, color: "#374151", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {breakResult.txSignature.slice(0, 20)}…{breakResult.txSignature.slice(-8)}
                      </span>
                      <a
                        href={`https://explorer.solana.com/tx/${breakResult.txSignature}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, fontWeight: 600, color: "#6D28D9", whiteSpace: "nowrap", textDecoration: "none" }}
                      >
                        View ↗
                      </a>
                    </div>
                  </div>
                )}
                {!breakResult.txSignature && <div style={{ marginBottom: 24 }} />}

                <button
                  onClick={() => { setBreakResult(null); onJarBroken(jar.id); }}
                  style={{ width: "100%", padding: "14px 0", background: "#111", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer", fontFamily: "var(--font)" }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* Edit schedule modal */}
          {editSchedule && (
            <EditScheduleModal
              schedule={editSchedule}
              onClose={() => setEditSchedule(null)}
              onSave={async (updated) => {
                await updateScheduleApi(editSchedule.id, updated);
                if (publicKey) {
                  const fresh = await fetchSchedules(publicKey.toBase58());
                  onScheduleUpdate(fresh);
                }
                setEditSchedule(null);
              }}
            />
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .jar-detail-wrap { padding: 24px 20px !important; }
          .jar-detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}

// Legacy JarCard — kept for JarsPage usage
function JarCard({ jar, onSelect }: { jar: JarType; onSelect?: () => void }) {
  const pct = Math.min(100, Math.round((jar.amount / Math.max(jar.goal, 0.01)) * 100));
  const isUsdc = jar.currency === "usdc";
  const future = jar.futureValue ?? jar.amount;
  const fmtFuture = isUsdc ? `$${future.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `◎${future.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtSaved = isUsdc ? `$${jar.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : `◎${jar.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  const yearsLeft = jar.unlockDate > 0 ? Math.max(0, Math.round((jar.unlockDate - Date.now() / 1000) / (365.25 * 86400))) : null;

  return (
    <div
      onClick={onSelect}
      style={{
        background: "#FFFFFF", border: "1px solid #E2E2DC", borderRadius: 14,
        padding: 28, display: "flex", flexDirection: "column", gap: 0,
        cursor: "pointer", transition: "box-shadow 0.15s, transform 0.15s",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,.08)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ fontSize: 15, fontWeight: 500 }}>{jar.emoji} {jar.name}</div>
        {yearsLeft !== null && (
          <div style={{ fontSize: 12, color: "#999999", background: "#F0F0EC", padding: "3px 9px", borderRadius: 20 }}>
            {yearsLeft > 0 ? `${yearsLeft} yr${yearsLeft !== 1 ? "s" : ""} left` : "unlocking"}
          </div>
        )}
      </div>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 40, fontWeight: 700, color: "#059669", letterSpacing: "-1.5px", lineHeight: 1 }}>{fmtFuture}</div>
        <div style={{ fontSize: 11, color: "#999999", marginTop: 3 }}>Estimated future value</div>
      </div>
      <div style={{ fontSize: 14, color: "#555555", marginTop: 16, marginBottom: 12 }}>
        <strong style={{ color: "#111111", fontWeight: 600 }}>{fmtSaved}</strong> saved so far
      </div>
      {(jar.jarType !== "SHARED" || jar.goal > 0) && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#999999", marginBottom: 6 }}>
            <span>Progress to goal</span><span>{pct}%</span>
          </div>
          <div style={{ height: 3, background: "#E2E2DC", borderRadius: 2, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#059669", borderRadius: 2 }} />
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, background: "#F0F0EC", color: "#555", padding: "2px 8px", borderRadius: 20, fontWeight: 500 }}>
          {JAR_TYPE_ICONS[jar.jarType]} {JAR_TYPE_LABELS[jar.jarType]}
        </span>
        <span style={{ fontSize: 13, color: "#999999" }}>
          {jar.jarType === "SHARED" ? "Creator withdraws anytime" : jar.locked ? "🔒 Locked · " + jar.unlockLabel : "Unlocked"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NEW JAR CARD — redesigned (dashboard grid)
// ---------------------------------------------------------------------------

function getJarCoverGradient(jar: JarType): string {
  switch (jar.jarType) {
    case "DATE":         return "linear-gradient(135deg,#d1fae5,#a7f3d0)";
    case "GOAL":         return "linear-gradient(135deg,#ede9fe,#ddd6fe)";
    case "GOAL_BY_DATE": return "linear-gradient(135deg,#fce7f3,#fbcfe8)";
    case "SHARED":       return "linear-gradient(135deg,#fef3c7,#fde68a)";
    default:             return "linear-gradient(135deg,#d1fae5,#a7f3d0)";
  }
}

function getJarTypeLabel(jar: JarType): string {
  return JAR_TYPE_LABELS[jar.jarType] ?? jar.unlockLabel;
}

function NewJarCard({ jar, isChartActive, onSelect, onChart, onAddFunds }: {
  jar: JarType;
  isChartActive: boolean;
  onSelect: () => void;
  onChart: (e: React.MouseEvent) => void;
  onAddFunds: (e: React.MouseEvent) => void;
}) {
  const pct = Math.min(100, Math.round((jar.amount / Math.max(jar.goal, 0.01)) * 100));
  const isUsdc = jar.currency === "usdc";
  const future = jar.futureValue ?? jar.amount;
  const fmtFuture = isUsdc
    ? `$${future.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    : `◎${future.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  const fmtSaved = isUsdc
    ? `$${jar.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
    : `◎${jar.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}`;
  const fmtGoal = jar.goal > 0
    ? (isUsdc ? `$${jar.goal.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : `◎${jar.goal.toFixed(2)}`)
    : null;
  const unlockStr = jar.unlockDate > 0
    ? `Unlocks ${new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
    : fmtGoal ? `Target ${fmtGoal}` : "No deadline";
  const unlockDateYears = jar.unlockDate > 0
    ? Math.max(0, (jar.unlockDate - Date.now() / 1000) / (365.25 * 86400))
    : null;
  const yearsLabel = unlockDateYears !== null
    ? (unlockDateYears > 0 ? `est. in ${Math.round(unlockDateYears)} yrs` : "est. at unlock")
    : "est. future value";

  const coverGradient = getJarCoverGradient(jar);
  const typeLabel = getJarTypeLabel(jar);

  // Generate avatars — single owner for now
  const ownerInitials = "IV";

  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      style={{
        background: "#FFFFFF",
        border: isChartActive ? "1px solid #059669" : "1px solid #E2E2DC",
        borderRadius: 14, overflow: "hidden", cursor: "pointer",
        display: "flex", flexDirection: "column",
        transition: "box-shadow .15s, transform .15s",
        boxShadow: isChartActive
          ? "0 0 0 2px #059669"
          : hovered ? "0 4px 20px rgba(0,0,0,.08)" : "none",
        transform: hovered ? "translateY(-1px)" : "none",
        position: "relative",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Cover */}
      <div style={{ height: 80, background: coverGradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, flexShrink: 0, position: "relative" }}>
        {jar.emoji}
        {/* Type badge */}
        <span style={{ position: "absolute", top: 7, left: 8, background: "rgba(0,0,0,.35)", backdropFilter: "blur(3px)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 20, letterSpacing: "0.3px", textTransform: "uppercase" }}>
          {typeLabel}
        </span>
        {/* Lock badge */}
        {jar.locked && (
          <span style={{ position: "absolute", top: 7, right: 8, fontSize: 12 }}>🔒</span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: "13px 14px 14px", flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Name */}
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{jar.name}</div>
        {/* Unlock / target */}
        <div style={{ fontSize: 11, color: "#999999", marginBottom: 10 }}>{unlockStr}</div>
        {/* Hero: future value if date set, current balance otherwise */}
        <div style={{ marginBottom: 8 }}>
          {jar.unlockDate > 0 ? (
            <>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#059669", letterSpacing: "-0.8px", lineHeight: 1 }}>{fmtFuture}</div>
              <div style={{ fontSize: 10, color: "#999999", marginTop: 2 }}>{yearsLabel}</div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#111111", letterSpacing: "-0.8px", lineHeight: 1 }}>{fmtSaved}</div>
              <div style={{ fontSize: 10, color: "#999999", marginTop: 2 }}>current balance</div>
            </>
          )}
        </div>
        {/* Saved line — only show when date-projected (otherwise hero IS the balance) */}
        {jar.unlockDate > 0 && (
          <div style={{ fontSize: 11, color: "#555555", marginBottom: 8 }}>
            <strong style={{ color: "#111111" }}>{fmtSaved}</strong> saved{fmtGoal ? ` · ${fmtGoal} goal` : ""}
          </div>
        )}
        {jar.unlockDate === 0 && fmtGoal && (
          <div style={{ fontSize: 11, color: "#555555", marginBottom: 8 }}>
            Goal: <strong style={{ color: "#111111" }}>{fmtGoal}</strong>
          </div>
        )}
        {/* Progress bar */}
        <div style={{ height: 3, background: "#E2E2DC", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#059669", borderRadius: 2 }} />
        </div>
        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1.5px solid #fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 700, background: "#F0F0EC", color: "#555555" }}>
                {ownerInitials}
              </div>
            </div>
            <span style={{ fontSize: 10, color: "#999999", marginLeft: 6 }}>1</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <button
              onClick={onAddFunds}
              style={{ fontSize: 10, fontWeight: 600, color: "#fff", padding: "3px 9px", background: "#111111", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "var(--font)" }}
            >
              + Add funds
            </button>
            <button
              onClick={onChart}
              style={{ fontSize: 10, fontWeight: 600, color: "#059669", padding: "3px 7px", background: "#ECFDF5", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "var(--font)" }}
            >
              Chart ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ADD JAR CARD
// ---------------------------------------------------------------------------

function AddJarCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#FFFFFF",
        border: `1.5px dashed ${hovered ? "#059669" : "#E2E2DC"}`,
        borderRadius: 14, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", minHeight: 200,
        cursor: "pointer", color: hovered ? "#059669" : "#999999",
        gap: 6, transition: "border-color .15s, color .15s",
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 300 }}>＋</div>
      <div style={{ fontSize: 12, fontWeight: 500 }}>New jar</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JAR CHART PANEL — inline between header and grid
// ---------------------------------------------------------------------------

function JarChartPanel({ jar, apy, onClose }: { jar: JarType; apy: { usdc_kamino: number; sol_marinade: number }; onClose: () => void }) {
  const isUsdc = jar.currency === "usdc";
  const apr = isUsdc ? apy.usdc_kamino / 100 : apy.sol_marinade / 100;
  const bankApr = 0.02;
  const principal = jar.amount;
  const yearsLeft = jar.unlockDate > 0
    ? Math.max(1, (jar.unlockDate - Date.now() / 1000) / (365.25 * 86400))
    : 10;
  const unlockStr = jar.unlockDate > 0
    ? new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : null;

  const jarfiEnd = Math.round(principal * Math.pow(1 + apr, yearsLeft));
  const bankEnd = Math.round(principal * Math.pow(1 + bankApr, yearsLeft));

  // SVG path computation
  const W = 760; const H = 150; const PADX = 0; const PADY = 15;
  const plotH = H - PADY - 20; // leave 20px for x-axis labels and 15px top

  function growthY(years: number, rate: number, p: number, maxVal: number): number {
    const val = p * Math.pow(1 + rate, years);
    return PADY + plotH - (val / maxVal) * plotH;
  }

  const maxVal = Math.max(jarfiEnd, bankEnd) * 1.05;
  const N = 60;
  let jarfiPath = "";
  let bankPath = "";
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * yearsLeft;
    const x = PADX + (i / N) * (W - PADX * 2);
    const jy = growthY(t, apr, principal, maxVal);
    const by = growthY(t, bankApr, principal, maxVal);
    jarfiPath += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${jy.toFixed(1)} `;
    bankPath += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${by.toFixed(1)} `;
  }

  // Jarfi area
  const lastJarfiX = (W - PADX * 2).toFixed(1);
  const lastJarfiY = growthY(yearsLeft, apr, principal, maxVal).toFixed(1);
  const firstY = growthY(0, apr, principal, maxVal).toFixed(1);
  const jarfiArea = `${jarfiPath} L${lastJarfiX} ${(H - 20).toFixed(1)} L${PADX} ${(H - 20).toFixed(1)} Z`;

  // Year labels
  const nowYear = new Date().getFullYear();
  const endYear = Math.round(nowYear + yearsLeft);
  const mid1Year = Math.round(nowYear + yearsLeft * 0.33);
  const mid2Year = Math.round(nowYear + yearsLeft * 0.66);

  const fmtVal = (n: number) => isUsdc ? `$${Math.round(n).toLocaleString()}` : `◎${n.toFixed(2)}`;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E2E2DC", borderRadius: 14, padding: "18px 20px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{jar.name} — Projection</div>
          <div style={{ fontSize: 11, color: "#999999", marginTop: 1 }}>
            Balance growth at {isUsdc ? apy.usdc_kamino : apy.sol_marinade}% APY{unlockStr ? ` · Unlocks ${unlockStr}` : ""}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ fontSize: 11, color: "#999999", cursor: "pointer", padding: "3px 8px", borderRadius: 6, border: "none", background: "none", fontFamily: "var(--font)" }}
        >
          ✕ Close
        </button>
      </div>
      <div style={{ width: "100%", height: 160, overflow: "hidden" }}>
        <svg viewBox={`0 0 ${W} ${H}`} fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ width: "100%", height: "100%" }}>
          <defs>
            <linearGradient id={`gJ_${jar.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#059669" stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Grid lines */}
          <line x1="0" y1={H - 20} x2={W} y2={H - 20} stroke="#E2E2DC" strokeWidth="1" />
          <line x1="0" y1={PADY + plotH * 0.5} x2={W} y2={PADY + plotH * 0.5} stroke="#E2E2DC" strokeWidth="0.5" strokeDasharray="3 3" />
          {/* Bank area (dashed gray) */}
          <path d={bankPath} stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
          {/* Jarfi area */}
          <path d={jarfiArea} fill={`url(#gJ_${jar.id})`} />
          <path d={jarfiPath} stroke="#059669" strokeWidth="2.5" fill="none" />
          {/* End labels */}
          <text x={W - 34} y={parseFloat(lastJarfiY) - 6} fontSize="11" fill="#059669" fontWeight="700" fontFamily="Inter,sans-serif" textAnchor="end">{fmtVal(jarfiEnd)}</text>
          <text x={W - 34} y={growthY(yearsLeft, bankApr, principal, maxVal) - 6} fontSize="11" fill="#94a3b8" fontFamily="Inter,sans-serif" textAnchor="end">{fmtVal(bankEnd)}</text>
          {/* X-axis labels */}
          <text x="4" y={H - 4} fontSize="10" fill="#999" fontFamily="Inter,sans-serif">Now</text>
          <text x={(W * 0.33).toFixed(0)} y={H - 4} fontSize="10" fill="#999" fontFamily="Inter,sans-serif">{mid1Year}</text>
          <text x={(W * 0.66).toFixed(0)} y={H - 4} fontSize="10" fill="#999" fontFamily="Inter,sans-serif">{mid2Year}</text>
          <text x={W - 4} y={H - 4} fontSize="10" fill="#999" fontFamily="Inter,sans-serif" textAnchor="end">{endYear}</text>
        </svg>
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555555" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#059669" }} />
          With Jarfi (staking)
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#555555" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#CBD5E1" }} />
          Bank (2% APY)
        </div>
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

// ---------------------------------------------------------------------------
// CopyField — copy-to-clipboard input
// ---------------------------------------------------------------------------

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", background: "#F0F0EC", borderRadius: 9, padding: "10px 14px" }}>
      <span style={{ flex: 1, fontSize: 12, color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{value}</span>
      <button
        onClick={() => { navigator.clipboard.writeText(value).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1800); }}
        style={{ fontSize: 11, fontWeight: 600, color: "var(--green)", background: "none", border: "none", cursor: "pointer", whiteSpace: "nowrap", fontFamily: "var(--font)" }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// EditScheduleModal — edit an existing schedule
// ---------------------------------------------------------------------------

function EditScheduleModal({
  schedule,
  onClose,
  onSave,
}: {
  schedule: Schedule;
  onClose: () => void;
  onSave: (params: { amount_usdc: number; frequency: "weekly" | "monthly"; day: number; hour: number; minute: number }) => Promise<void>;
}) {
  const [amount, setAmount] = useState(String(schedule.amount_usdc / 100));
  const [day, setDay] = useState(String(schedule.day));
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        amount_usdc: Math.round(parseFloat(amount) * 100),
        frequency: schedule.frequency,
        day: Number(day),
        hour: schedule.hour,
        minute: schedule.minute,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.4)", padding: 24 }} onClick={onClose}>
      <div style={{ width: "100%", maxWidth: 400, background: "var(--bg)", borderRadius: 18, padding: 32 }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Edit monthly reminder</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Monthly amount ($)</div>
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15, fontWeight: 600, background: "var(--bg-muted)", color: "var(--text-secondary)", minWidth: 40, textAlign: "center" }}>$</div>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none" }}
            />
          </div>
        </div>
        {schedule.frequency === "monthly" && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 6 }}>Day of month (1–28)</div>
            <input
              type="number" min={1} max={28}
              value={day}
              onChange={e => setDay(e.target.value)}
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none" }}
            />
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", border: "1px solid var(--border)", borderRadius: 9, fontSize: 14, background: "none", cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: "11px 0", background: "#111", color: "#fff", borderRadius: 9, fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", fontFamily: "var(--font)", opacity: saving ? 0.6 : 1 }}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
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
