"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { depositUsdcFromWallet } from "@/lib/deposit-usdc";
import { recordDirectDeposit } from "@/lib/api";
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
import { JAR_IMAGE_ORDER, JAR_IMAGE_LABELS, JAR_IMAGE_TINTS, JAR_SVGS, type JarImageKey } from "@/lib/jar-illustrations";

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

function getJarImage(pubkey: string): JarImageKey | null {
  if (typeof window === "undefined") return null;
  return (localStorage.getItem(`jar_image_${pubkey}`) as JarImageKey) ?? null;
}

function saveJarImage(pubkey: string, image: JarImageKey) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`jar_image_${pubkey}`, image);
}

function getJarCustomImage(pubkey: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(`jar_custom_image_${pubkey}`) ?? null;
}

function saveJarCustomImage(pubkey: string, dataUrl: string) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(`jar_custom_image_${pubkey}`, dataUrl); } catch { /* quota exceeded */ }
}

const DEFAULT_IMAGE_BY_TYPE: Record<JarTypeEnum, JarImageKey> = {
  GOAL: "house",
  DATE: "baby",
  GOAL_BY_DATE: "graduation",
  SHARED: "gift",
};

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
  image: JarImageKey | null;
  customImage?: string | null;
};

// ---------------------------------------------------------------------------
// Demo jars — hardcoded for showcase (real pubkeys on devnet)
// ---------------------------------------------------------------------------

const DEMO_JARS: JarType[] = [
  {
    id: "FeAzYeZuvo6eaPcsVp1Yguegcp2AhwwPWTfPV5Z4B9hC",
    emoji: "🎂", name: "Anya's Birthday", description: "Birthday gift jar",
    amount: 45, goal: 200, locked: false, unlockLabel: "Open", unlockDate: 0,
    currency: "usdc", futureValue: 49, jarType: "GOAL", mode: 1, image: "gift",
  },
  {
    id: "ExvN6nxRbWpqQJrpG6shY9tbcWTtHKEaJDmFVebxFqu4",
    emoji: "✈️", name: "Japan Trip", description: "Group savings for Japan",
    amount: 340, goal: 1500, locked: true,
    unlockLabel: "Dec 2026", unlockDate: Math.floor(new Date("2026-12-01").getTime() / 1000),
    currency: "usdc", futureValue: 398, jarType: "GOAL_BY_DATE", mode: 2, image: "travel",
  },
  {
    id: "28teBgT2U1y25ARUkgGfHjeyBHhnJXorVtLs6Qk93ppc",
    emoji: "🏍️", name: "Motorcycle Fund", description: "Saving for a motorcycle",
    amount: 850, goal: 3000, locked: false, unlockLabel: "Open", unlockDate: 0,
    currency: "usdc", futureValue: 930, jarType: "GOAL", mode: 1, image: "bike",
  },
  {
    id: "DemoJar4SharedXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    emoji: "👨‍👩‍👧", name: "Family Fund", description: "Family group savings",
    amount: 1240, goal: 5000, locked: false, unlockLabel: "Open", unlockDate: 0,
    currency: "usdc", futureValue: 1360, jarType: "SHARED", mode: 0, image: "gift",
  },
];

const NOW = Math.floor(Date.now() / 1000);
// Human-readable names for demo contributors
const DEMO_NAMES: Record<string, string> = {
  "7vK2MtR3mPq9xNsL": "Grandma 👵",
  "3nR8xWt9kLsPmVqJ": "Uncle Mike 🎩",
  "5mP4kLs2nQrTbYzX": "Mom 💐",
  "9xWt3nR8kLsPvCmN": "Dad 🎯",
  "2kLs5mP4nQrTwEuI": "Best Friend ✈️",
  "8pQr7nKs1mLtXvBo": "Colleague 👷",
  "4mNv6pQs9kLrYwAj": "Aunt Maria 🌸",
  "1kRt8mPs3nQvZxCu": "Neighbor 🏡",
};

// Spread across 5 months so the monthly chart has meaningful data
const DEMO_CONTRIBUTIONS: JarContribution[] = [
  { pubkey:"dc1", contributor:"7vK2MtR3mPq9xNsL", amount:50_000_000,  comment:"Happy birthday! 🎂",    createdAt: NOW - 150 * 86400 },
  { pubkey:"dc2", contributor:"3nR8xWt9kLsPmVqJ", amount:100_000_000, comment:"From Uncle Mike 🎉",    createdAt: NOW - 148 * 86400 },
  { pubkey:"dc3", contributor:"5mP4kLs2nQrTbYzX", amount:75_000_000,  comment:"From Mom 💐",           createdAt: NOW - 110 * 86400 },
  { pubkey:"dc4", contributor:"9xWt3nR8kLsPvCmN", amount:200_000_000, comment:"",                       createdAt: NOW - 108 * 86400 },
  { pubkey:"dc5", contributor:"2kLs5mP4nQrTwEuI", amount:30_000_000,  comment:"Go Japan! ✈️",          createdAt: NOW - 75 * 86400 },
  { pubkey:"dc6", contributor:"8pQr7nKs1mLtXvBo", amount:75_000_000,  comment:"Fuel for the road 🏍️", createdAt: NOW - 45 * 86400 },
  { pubkey:"dc7", contributor:"4mNv6pQs9kLrYwAj", amount:150_000_000, comment:"Let's go to Tokyo!",    createdAt: NOW - 43 * 86400 },
  { pubkey:"dc8", contributor:"1kRt8mPs3nQvZxCu", amount:20_000_000,  comment:"Small contribution 🙏", createdAt: NOW - 12 * 86400 },
  { pubkey:"dc9", contributor:"7vK2MtR3mPq9xNsL", amount:25_000_000,  comment:"Keep going! 💪",        createdAt: NOW - 3 * 86400 },
];

// Per-jar demo contributions for detail panel
const DEMO_CONTRIBUTIONS_BY_JAR: Record<string, JarContribution[]> = {
  "FeAzYeZuvo6eaPcsVp1Yguegcp2AhwwPWTfPV5Z4B9hC": [
    { pubkey:"a1", contributor:"7vK2MtR3mPq9xNsL", amount:50_000_000,  comment:"Happy birthday! 🎂",   createdAt: NOW - 3 * 86400 },
    { pubkey:"a2", contributor:"3nR8xWt9kLsPmVqJ", amount:100_000_000, comment:"From Uncle Mike! 🎉",  createdAt: NOW - 10 * 86400 },
    { pubkey:"a3", contributor:"5mP4kLs2nQrTbYzX", amount:25_000_000,  comment:"From Mom 💐",          createdAt: NOW - 30 * 86400 },
  ],
  "ExvN6nxRbWpqQJrpG6shY9tbcWTtHKEaJDmFVebxFqu4": [
    { pubkey:"j1", contributor:"2kLs5mP4nQrTwEuI", amount:30_000_000,  comment:"Go Japan! ✈️",         createdAt: NOW - 5 * 86400 },
    { pubkey:"j2", contributor:"4mNv6pQs9kLrYwAj", amount:150_000_000, comment:"Let's go to Tokyo! 🗾", createdAt: NOW - 20 * 86400 },
    { pubkey:"j3", contributor:"9xWt3nR8kLsPvCmN", amount:80_000_000,  comment:"",                      createdAt: NOW - 45 * 86400 },
    { pubkey:"j4", contributor:"8pQr7nKs1mLtXvBo", amount:75_000_000,  comment:"Mount Fuji here we go 🗻", createdAt: NOW - 90 * 86400 },
  ],
  "28teBgT2U1y25ARUkgGfHjeyBHhnJXorVtLs6Qk93ppc": [
    { pubkey:"m1", contributor:"1kRt8mPs3nQvZxCu", amount:20_000_000,  comment:"Ride safe! 🤘",         createdAt: NOW - 7 * 86400 },
    { pubkey:"m2", contributor:"7vK2MtR3mPq9xNsL", amount:25_000_000,  comment:"Fuel for the road 🏍️", createdAt: NOW - 40 * 86400 },
    { pubkey:"m3", contributor:"8pQr7nKs1mLtXvBo", amount:75_000_000,  comment:"Go for it! 💪",         createdAt: NOW - 80 * 86400 },
  ],
  "DemoJar4SharedXXXXXXXXXXXXXXXXXXXXXXXXXXXXX": [
    { pubkey:"f1", contributor:"5mP4kLs2nQrTbYzX", amount:300_000_000, comment:"From Mom 💐",            createdAt: NOW - 5 * 86400 },
    { pubkey:"f2", contributor:"9xWt3nR8kLsPvCmN", amount:500_000_000, comment:"Dad's contribution 🎯", createdAt: NOW - 15 * 86400 },
    { pubkey:"f3", contributor:"7vK2MtR3mPq9xNsL", amount:200_000_000, comment:"From Grandma 👵",       createdAt: NOW - 30 * 86400 },
    { pubkey:"f4", contributor:"3nR8xWt9kLsPmVqJ", amount:150_000_000, comment:"Uncle Mike pitches in 🎩", createdAt: NOW - 60 * 86400 },
  ],
};

// ---------------------------------------------------------------------------
// Dashboard root
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const router = useRouter();
  const [activePage, setActivePage] = useState<
    "dashboard" | "analytics" | "contributors" | "demo"
  >("demo");
  const prevKeyRef = useRef<string | null>(null);
  const pendingJarRef = useRef<string | null>(null);
  const [modal, setModal] = useState<"new-jar" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scenario, setScenario] = useState(50);
  const [showWelcome, setShowWelcome] = useState(false);
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem('jarfi_welcome_seen')) {
      setShowWelcome(true);
    }
  }, []);
  const dismissWelcome = () => {
    setShowWelcome(false);
    if (typeof localStorage !== 'undefined') localStorage.setItem('jarfi_welcome_seen', '1');
  };

  const { publicKey, wallet, connecting, connected } = useWallet();
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => { setHasMounted(true); }, []);

  // walletSettled: keep splash until we know whether wallet auto-connected.
  // Without this, there's a 1-render gap where hasMounted=true but connecting
  // hasn't started yet → flashes the disconnected/demo state.
  const [walletSettled, setWalletSettled] = useState(false);
  useEffect(() => {
    if (!hasMounted) return;
    const storedWallet = typeof localStorage !== 'undefined' ? localStorage.getItem('walletName') : null;
    if (!storedWallet || connected) { setWalletSettled(true); return; }
    // Wallet adapter will autoConnect — wait for it, cap at 1.2s
    const t = setTimeout(() => setWalletSettled(true), 1200);
    return () => clearTimeout(t);
  }, [hasMounted, connected]);
  const { connection } = useConnection();
  const { jars: liveJars, loading: jarsLoading, refresh: refreshJars, addJar, removeJar } = useJars();
  const [apy, setApy] = useState({ usdc_kamino: 5.5, sol_marinade: 6.85 });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [contributions, setContributions] = useState<JarContribution[]>([]);
  const [confirmBanner, setConfirmBanner] = useState<{
    jar_pubkey: string;
    amount_usdc: number;
    manual?: boolean;
  } | null>(null);
  const [addFundsJar, setAddFundsJar] = useState<{ pubkey: string; name: string; currency: "usdc" | "sol" } | null>(null);
  const [addFundsMethod, setAddFundsMethod] = useState<"choose" | "wallet" | "transak">("choose");
  const [directDepositAmount, setDirectDepositAmount] = useState("100");
  const [directDepositLoading, setDirectDepositLoading] = useState(false);
  const [initialDepositPrompt, setInitialDepositPrompt] = useState<{ pubkey: string; name: string; currency: "usdc" | "sol" } | null>(null);
  const [cosignerInvite, setCosignerInvite] = useState<{ jar_pubkey: string; token: string; name: string } | null>(null);

  // Switch tab when wallet connects / disconnects
  useEffect(() => {
    const key = publicKey?.toBase58() ?? null;
    if (key && !prevKeyRef.current) { setActivePage("dashboard"); router.replace("/dashboard?page=dashboard", { scroll: false }); }
    if (!key && prevKeyRef.current)  { setActivePage("demo");      router.replace("/dashboard?page=demo",      { scroll: false }); }
    prevKeyRef.current = key;
  }, [publicKey, router]);

  useEffect(() => {
    fetchApy().then((d) =>
      setApy({ usdc_kamino: d.usdc_kamino, sol_marinade: d.sol_marinade })
    );
  }, []);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | null>(null);
  useEffect(() => {
    if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
  }, []);

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
    Promise.all(liveJars.filter(j => !j.pubkey.startsWith("Demo")).map(j => fetchContributionsForJar(j.pubkey)))
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

    // Push notification confirm flow
    const confirmPubkey = p.get("confirm");
    if (confirmPubkey) {
      const amount_usdc = Number(p.get("amount") ?? 0);
      const manual = p.get("manual") === "1";
      setConfirmBanner({ jar_pubkey: confirmPubkey, amount_usdc, manual });
    }

    // Restore page tab from URL (demo is guest-only — redirect to dashboard if wallet connected)
    const page = p.get("page");
    if (page && ["dashboard", "analytics", "contributors", "demo"].includes(page)) {
      const isGuest = !publicKey;
      setActivePage((page === "demo" && !isGuest) ? "dashboard" : page as "dashboard" | "analytics" | "contributors" | "demo");
    }

    // Open new-jar modal from landing page CTAs
    const action = p.get("action");
    if (action === "new-jar") setModal("new-jar");

    // Restore selected jar from URL (applied once jars load)
    const jarPubkey = p.get("jar");
    if (jarPubkey) pendingJarRef.current = jarPubkey;
  }, []);

  // Close sidebar when navigating + sync URL
  const navigate = useCallback(
    (page: typeof activePage) => {
      setActivePage(page);
      setSidebarOpen(false);
      router.replace(`/dashboard?page=${page}`, { scroll: false });
    },
    [router]
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
          image: getJarImage(j.pubkey) ?? DEFAULT_IMAGE_BY_TYPE[jarType],
          customImage: getJarCustomImage(j.pubkey),
        };
      }),
    [liveJars, apy]
  );

  const effectiveContribsForPages = publicKey ? contributions : DEMO_CONTRIBUTIONS;
  const effectiveJarsForPages = publicKey ? normalizedLive : (DEMO_JARS as JarType[]);

  const greeting = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : null;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const avatarInitials = greeting ? greeting.slice(0, 2).toUpperCase() : "—";

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F4F4F1", fontFamily: "var(--font)" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── V3 Sidebar ───────────────────────────────────────────────────────── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-shrink-0 flex-col md:relative md:translate-x-0 transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{ width: 200, background: "#fff", borderRight: "1px solid #EBEBEB", padding: "20px 12px 20px", minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        {/* Logo */}
        <Link href="/" onClick={() => setSidebarOpen(false)} style={{ textDecoration: "none", padding: "0 8px", marginBottom: 8, display: "block" }}>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.5px", color: "#111" }}>jar<span style={{ color: "#1F8A5B" }}>fi</span></span>
        </Link>

        {/* Home link */}
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#888", textDecoration: "none", padding: "0 8px", marginBottom: 8 }}>
          ← jarfi.xyz
        </Link>

        {/* New jar button — only when wallet connected */}
        {publicKey && (
          <button
            onClick={() => { setSidebarOpen(false); setModal("new-jar"); }}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", padding: "9px 0", background: "#111", color: "#fff", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)", marginBottom: 20 }}
          >
            + New jar
          </button>
        )}
        {!publicKey && <div style={{ marginBottom: 12 }} />}

        {/* Nav items — My Jars / Activity / People only with wallet */}
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { key: "dashboard",    icon: "jar",      label: "My jars",  walletOnly: true,  guestOnly: false },
            { key: "analytics",    icon: "activity", label: "Activity", walletOnly: true,  guestOnly: false },
            { key: "contributors", icon: "people",   label: "People",   walletOnly: true,  guestOnly: false },
            { key: "docs",         icon: "docs",     label: "Docs",     walletOnly: false, guestOnly: false },
            { key: "demo",         icon: "star",     label: "Demo",     walletOnly: false, guestOnly: true  },
          ].filter(item =>
            (!item.walletOnly || !!publicKey) && (!item.guestOnly || !publicKey)
          ).map(({ key, icon, label }) => {
            const active = activePage === key;
            // "Docs" opens external link
            if (key === "docs") {
              return (
                <a key="docs" href="https://jarfi.gitbook.io/jarfi-docs/" target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, textDecoration: "none", transition: "background .12s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#F5F5F3"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#F0F0EE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#666" }}>
                    <SidebarIcon name="docs" />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#444", letterSpacing: "-0.01em" }}>Docs ↗</span>
                </a>
              );
            }
            return (
              <button key={key} onClick={() => navigate(key as typeof activePage)}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font)", background: active ? "#ECFDF5" : "transparent", transition: "background .12s" }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "#F5F5F3"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ width: 28, height: 28, borderRadius: "50%", background: active ? "#1F8A5B" : "#F0F0EE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: active ? "#fff" : "#666", transition: "background .12s" }}>
                  <SidebarIcon name={icon} />
                </div>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 500, color: active ? "#1F8A5B" : "#444", letterSpacing: "-0.01em" }}>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Spacer */}
        <div style={{ marginTop: "auto" }} />

        {/* Twitter follow */}
        <a
          href="https://x.com/jarfixyz"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, textDecoration: "none", marginBottom: 4, transition: "background .12s" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#F5F5F3"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111", letterSpacing: "-0.01em" }}>Follow on X</div>
            <div style={{ fontSize: 11, color: "#888" }}>Updates &amp; news</div>
          </div>
        </a>
      </aside>

      {/* ── Main ───────────────────────────────────────────────────────────── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* Splash: wait for mount AND wallet settlement to prevent flash */}
        {(!hasMounted || !walletSettled) && (
          <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#F4F4F1", zIndex: 9999 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏺</div>
              <div style={{ fontSize: 14, color: "#888", fontFamily: "var(--font)" }}>Loading...</div>
            </div>
          </div>
        )}
        {/* Enable notifications banner */}
        {publicKey && notifPermission !== "granted" && notifPermission !== null && (
          <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-6 py-3 text-sm">
            {notifPermission === "denied"
              ? <span className="text-amber-800">🔔 Notifications are blocked — allow jarfi.xyz in your browser settings to get reminders</span>
              : <span className="text-amber-800">🔔 Enable notifications to receive monthly deposit reminders</span>
            }
            {notifPermission !== "denied" && (
              <button
                onClick={async () => {
                  await subscribeToPush(publicKey.toBase58());
                  if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
                }}
                className="ml-4 shrink-0 rounded-full bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-600"
              >
                Enable
              </button>
            )}
          </div>
        )}
        {/* Test push button — shown when notifications are granted */}
        {publicKey && notifPermission === "granted" && (
          <div className="flex items-center justify-between bg-green-50 border-b border-green-200 px-6 py-2 text-sm">
            <span className="text-green-800">🔔 Push notifications enabled</span>
            <div className="flex gap-2 ml-4">
              <button
                onClick={async () => {
                  // Direct local test — no server, tests SW showNotification directly
                  const reg = await navigator.serviceWorker.ready.catch(() => null);
                  if (!reg) { showToast("Service worker not ready"); return; }
                  await reg.showNotification("Jarfi test 🏺", { body: "Local notification works!", icon: "/favicon-32.png" });
                  showToast("Local notification triggered");
                }}
                className="shrink-0 rounded-full bg-gray-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-600"
              >
                Local test
              </button>
              <button
                onClick={async () => {
                  const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app";
                  const saved = await subscribeToPush(publicKey.toBase58()).catch(() => false);
                  if (!saved) { showToast("Failed to save push subscription"); return; }
                  const res = await fetch(`${API_URL}/push/test-send/${publicKey.toBase58()}`, { method: "POST" });
                  const data = await res.json();
                  if (data.ok) showToast("Push sent via server 🔔");
                  else showToast(`Push error: ${data.error}`);
                }}
                className="shrink-0 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >
                Server test
              </button>
            </div>
          </div>
        )}

        {confirmBanner && (
          <div className="sticky top-0 z-20 flex items-center justify-between bg-sol-purple px-6 py-3 text-sm font-medium text-white shadow">
            <span>
              {confirmBanner.manual
                ? `⚠️ Reminder — deposit $${(confirmBanner.amount_usdc / 100).toFixed(2)} manually`
                : `⏰ Time to top up — $${(confirmBanner.amount_usdc / 100).toFixed(2)} → Jar ${confirmBanner.jar_pubkey.slice(0, 4)}…${confirmBanner.jar_pubkey.slice(-4)}`}
            </span>
            <div className="ml-4 flex items-center gap-2">
              <button
                onClick={() => {
                  const jarName = normalizedLive.find(j => j.id === confirmBanner!.jar_pubkey)?.name ?? "your jar";
                  setDirectDepositAmount(String(confirmBanner!.amount_usdc / 100));
                  setAddFundsJar({ pubkey: confirmBanner!.jar_pubkey, name: jarName, currency: "usdc" });
                  setAddFundsMethod(publicKey ? "wallet" : "transak");
                  setConfirmBanner(null);
                }}
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

        {/* Add funds — method chooser or direct flows */}
        {addFundsJar && !addFundsJar.pubkey.startsWith("Demo") && (() => {
          const canUseWallet = !!publicKey;
          const method = canUseWallet ? addFundsMethod : "transak";
          const closeAll = () => { setAddFundsJar(null); setAddFundsMethod("choose"); setDirectDepositAmount("100"); };

          if (method === "transak") {
            return (
              <TransakWidget
                vaultAddress={addFundsJar.pubkey}
                contributorMessage={`Top up ${addFundsJar.name}`}
                onSuccess={() => { closeAll(); showToast("Deposit confirmed ✅"); refreshJars(); }}
                onClose={closeAll}
              />
            );
          }

          // Overlay modal wrapper
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
              <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 20px 60px rgba(0,0,0,.25)", fontFamily: "var(--font)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>Add funds — {addFundsJar.name}</div>
                  <button onClick={closeAll} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#888", lineHeight: 1 }}>×</button>
                </div>

                {method === "choose" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <button onClick={() => setAddFundsMethod("wallet")}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: "1.5px solid #059669", borderRadius: 14, cursor: "pointer", background: "#ECFDF5", fontFamily: "var(--font)", textAlign: "left" }}>
                      <span style={{ fontSize: 26 }}>👛</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "#059669" }}>From wallet</div>
                        <div style={{ fontSize: 12, color: "#555", marginTop: 2 }}>Send USDC directly · No KYC · Instant</div>
                      </div>
                    </button>
                    <button onClick={() => setAddFundsMethod("transak")}
                      style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", border: "1px solid var(--border)", borderRadius: 14, cursor: "pointer", background: "var(--bg)", fontFamily: "var(--font)", textAlign: "left" }}>
                      <span style={{ fontSize: 26 }}>💳</span>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500 }}>Buy with card</div>
                        <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>Powered by Transak · KYC required</div>
                      </div>
                    </button>
                  </div>
                )}

                {method === "wallet" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ fontSize: 13, color: "#555" }}>USDC will be sent from your connected wallet directly on-chain.</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Amount (USDC)</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <div style={{ padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 8, fontSize: 15, fontWeight: 600, background: "var(--bg-muted)", color: "#888", minWidth: 36, textAlign: "center" }}>$</div>
                        <input type="number" min="1" step="1"
                          value={directDepositAmount}
                          onChange={e => setDirectDepositAmount(e.target.value)}
                          style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none" }}
                        />
                      </div>
                    </div>
                    <button
                      disabled={directDepositLoading || !directDepositAmount || parseFloat(directDepositAmount) <= 0}
                      onClick={async () => {
                        if (!wallet?.adapter || !connection) return;
                        setDirectDepositLoading(true);
                        try {
                          const amt = parseFloat(directDepositAmount);
                          const sig = await depositUsdcFromWallet(wallet.adapter as never, connection, addFundsJar.pubkey, amt);
                          await recordDirectDeposit({
                            jar_pubkey: addFundsJar.pubkey,
                            depositor_pubkey: publicKey!.toBase58(),
                            amount_usdc: amt,
                            tx_signature: sig,
                            comment: `Direct deposit to ${addFundsJar.name}`,
                          });
                          closeAll();
                          showToast("Deposit confirmed ✅");
                          refreshJars();
                        } catch (e: unknown) {
                          const msg = e instanceof Error ? e.message : "Transaction failed";
                          showToast(msg.includes("0x1") ? "Insufficient USDC balance" : "Transaction rejected");
                        } finally {
                          setDirectDepositLoading(false);
                        }
                      }}
                      style={{ width: "100%", padding: "14px", background: directDepositLoading ? "#ccc" : "#059669", color: "#fff", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: directDepositLoading ? "not-allowed" : "pointer", fontFamily: "var(--font)" }}
                    >
                      {directDepositLoading ? "Sending…" : `Send $${directDepositAmount || "0"} USDC`}
                    </button>
                    <button onClick={() => setAddFundsMethod("choose")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: "#888", fontFamily: "var(--font)" }}>← Back</button>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

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
        {activePage === "analytics" && (
          <AnalyticsPage
            liveJars={effectiveJarsForPages}
            contributions={effectiveContribsForPages}
            apy={apy}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
            onBack={() => navigate("dashboard")}
          />
        )}
        {activePage === "contributors" && (
          <ContributorsPage
            contributions={effectiveContribsForPages}
            liveJars={effectiveJarsForPages}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
            onBack={() => navigate("dashboard")}
          />
        )}
        {activePage === "demo" && (
          <DemoPage
            apy={apy}
            onMenuToggle={() => setSidebarOpen((v) => !v)}
            onAddFunds={() => { /* demo jars — no real deposits */ }}
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
              if (params.jarImage) saveJarImage(jarPubkey, params.jarImage);
              if (params.customImage) saveJarCustomImage(jarPubkey, params.customImage);
              fetchJarByPubkey(connection, new PublicKey(jarPubkey))
                .then(jar => { if (jar) addJar(jar); })
                .catch(() => {});
              fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app"}/jar/meta`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ pubkey: jarPubkey, name: params.jarName, emoji: params.jarEmoji, jarType: contractToJarType(params.mode, params.unlockDate), image: params.jarImage }),
              }).then(r => r.json()).then(d => { if (d.share_slug) saveJarSlug(jarPubkey, d.share_slug); }).catch(() => {});
              if (params.recurring) {
                try {
                  await createScheduleApi({
                    jar_pubkey: jarPubkey,
                    owner_pubkey: publicKey.toBase58(),
                    ...params.recurring,
                  });
                  setSchedules(await fetchSchedules(publicKey.toBase58()));
                } catch { showToast("⚠️ Jar created but reminders couldn't be set up — try again in settings"); }
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
              // Subscribe to push after jar creation so recurring reminders work
              subscribeToPush(publicKey.toBase58()).then(() => {
                if (typeof Notification !== "undefined") setNotifPermission(Notification.permission);
              }).catch(() => {});
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              console.error("[create-jar] error:", msg);
              throw e; // let modal show inline error + retry button
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

      {/* ── Welcome modal (first-time, no wallet) ───────────────────────── */}
      {showWelcome && !publicKey && walletSettled && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:24 }} onClick={dismissWelcome}>
          <div style={{ background:"#fff", borderRadius:24, padding:40, maxWidth:440, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign:"center", marginBottom:32 }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🏺</div>
              <div style={{ fontSize:24, fontWeight:700, letterSpacing:"-0.5px", marginBottom:8 }}>Welcome to Jarfi</div>
              <div style={{ fontSize:14, color:"#666", lineHeight:1.6 }}>
                Onchain savings jars anyone can top up — no crypto needed to contribute.
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:28 }}>
              {[
                { icon:"🎯", text:"Set a savings goal and timeline" },
                { icon:"🔗", text:"Share a link — anyone pays by card" },
                { icon:"📈", text:"Earn up to 8.2% APY automatically" },
              ].map(f => (
                <div key={f.text} style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ width:34, height:34, borderRadius:9, background:"#F4F4F1", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{f.icon}</div>
                  <div style={{ fontSize:13, color:"#444" }}>{f.text}</div>
                </div>
              ))}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div style={{ display:"flex", justifyContent:"center" }} onClick={dismissWelcome}>
                <WalletButton />
              </div>
              <button onClick={dismissWelcome} style={{ width:"100%", padding:"11px 0", background:"none", border:"1px solid #E0E0DC", borderRadius:9, fontSize:13, color:"#666", cursor:"pointer", fontFamily:"var(--font)" }}>
                Explore demo first →
              </button>
            </div>
          </div>
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
  const jarRouter = useRouter();
  const [selectedJar, setSelectedJar] = useState<JarType | null>(null);
  const [sortBy, setSortBy] = useState<"recent" | "amount" | "progress" | "unlock">("recent");

  const selectJar = useCallback((jar: JarType | null) => {
    setSelectedJar(jar);
    if (jar) jarRouter.replace(`/dashboard?page=dashboard&jar=${jar.id}`, { scroll: false });
    else jarRouter.replace(`/dashboard?page=dashboard`, { scroll: false });
  }, [jarRouter]);

  // Auto-select jar from URL once liveJars load (useEffect reads window client-side only)
  const [pendingJarPubkey, setPendingJarPubkey] = useState<string | null>(null);
  useEffect(() => {
    const jar = new URLSearchParams(window.location.search).get("jar");
    if (jar) setPendingJarPubkey(jar);
  }, []);
  useEffect(() => {
    if (!pendingJarPubkey || liveJars.length === 0) return;
    const jar = liveJars.find(j => j.id === pendingJarPubkey);
    if (jar) { selectJar(jar); setPendingJarPubkey(null); }
  }, [liveJars, pendingJarPubkey, selectJar]);

  // When no wallet — display demo data so the page is useful immediately
  const effectiveJars = hasWallet ? liveJars : DEMO_JARS;
  const effectiveContribs = hasWallet ? contributions : DEMO_CONTRIBUTIONS;

  const sortedJars = useMemo(() => {
    const jars = [...effectiveJars];
    switch (sortBy) {
      case "amount":  return jars.sort((a, b) => b.amount - a.amount);
      case "progress": return jars.sort((a, b) => {
        const pA = a.goal > 0 ? a.amount / a.goal : 0;
        const pB = b.goal > 0 ? b.amount / b.goal : 0;
        return pB - pA;
      });
      case "unlock": return jars.sort((a, b) => (a.unlockDate || 9e9) - (b.unlockDate || 9e9));
      default: return jars; // recent = original order
    }
  }, [effectiveJars, sortBy]);

  const totalSaved = effectiveJars.reduce((s, j) => s + j.amount, 0);
  const lockedCount = effectiveJars.filter((j) => j.locked).length;
  const estimatedYieldMonthly = effectiveJars.reduce((s, j) => {
    const rate =
      j.currency === "usdc" ? apy.usdc_kamino / 100 : apy.sol_marinade / 100;
    return s + (j.amount * rate) / 12;
  }, 0);
  const monthlyPlan = schedules.reduce((s, sc) => s + sc.amount_usdc / 100, 0);
  const uniqueContributors = new Set(effectiveContribs.map((c) => c.contributor))
    .size;
  const totalContributed = effectiveContribs.reduce(
    (s, c) => s + c.amount / 1_000_000,
    0
  );

  // Forecast: primary jar APY, 18 years remaining
  const primaryApr =
    effectiveJars[0]?.currency === "sol"
      ? apy.sol_marinade
      : apy.usdc_kamino;
  const yearsRemaining = useMemo(() => {
    const jar = effectiveJars[0];
    if (!jar || jar.unlockDate <= 0) return 18;
    const remaining = Math.max(
      1,
      Math.ceil((jar.unlockDate - Date.now() / 1000) / (365.25 * 86400))
    );
    return Math.min(remaining, 25);
  }, [effectiveJars]);

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
  const totalFutureValue = effectiveJars.reduce((s, j) => s + (j.futureValue ?? j.amount), 0);
  const totalYieldEarned = effectiveJars.reduce((s, j) => {
    const rate = j.currency === "usdc" ? apy.usdc_kamino / 100 : apy.sol_marinade / 100;
    return s + j.amount * rate;
  }, 0);

  if (selectedJar) {
    return (
      <JarDetailPanel
        jar={selectedJar}
        apy={apy}
        schedules={schedules}
        onBack={() => selectJar(null)}
        onMenuToggle={onMenuToggle}
        onAddFunds={onAddFunds}
        onScheduleUpdate={onScheduleUpdate}
        onJarBroken={(pubkey) => { onJarBroken(pubkey); selectJar(null); }}
        initialContribs={DEMO_CONTRIBUTIONS_BY_JAR[selectedJar.id]}
      />
    );
  }

  return (
    <div style={{ background: "#F4F4F1", flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Mobile hamburger bar */}
      <div className="flex items-center justify-between border-b border-black/5 bg-[#F4F4F1] px-4 py-3 md:hidden">
        <button onClick={onMenuToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="#111" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.3px" }}>jarfi</div>
        <WalletButton compact />
      </div>

      <div style={{ padding: "20px 24px 40px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>

        {/* ── Header ──────────────────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 3 }}>Overview</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em" }}>
              My Jars
            </div>
          </div>
          <div className="hidden md:flex" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <WalletButton compact />
            {hasWallet && (
              <button onClick={onNewJar} style={{ padding: "9px 16px", background: "#111", color: "#fff", borderRadius: 10, fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer", fontFamily: "var(--font)", letterSpacing: "-0.01em" }}>
                + New jar
              </button>
            )}
          </div>
        </div>

        {/* ── No wallet — show demo with connect-wallet banner ──────────────── */}
        {!hasWallet && (
          <>
            {/* Connect banner */}
            <div style={{ background: "#fff", border: "1px solid #EAEAEA", borderRadius: 14, padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#EAF4EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>🏺</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 1 }}>Demo mode — connect a wallet to create your own jars</div>
                  <div style={{ fontSize: 12, color: "#888" }}>Real jars on Solana · up to 8.2% APY</div>
                </div>
              </div>
            </div>
          </>
        )}

        <>
            {/* ── V3 Hero ─────────────────────────────────────────────────────── */}
            {effectiveJars.length > 0 && (
              <V3Hero
                totalSaved={totalSaved}
                totalFutureValue={totalFutureValue}
                totalYieldEarned={totalYieldEarned}
                estimatedYieldMonthly={estimatedYieldMonthly}
                uniqueContributors={uniqueContributors}
                liveJars={effectiveJars}
                apy={apy}
              />
            )}

            {/* ── Forecast + Suggestions ──────────────────────────────────────── */}
            {effectiveJars.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
                <V3Forecast totalSaved={totalSaved} apy={apy} schedules={schedules} jars={effectiveJars} />
                <V3Suggestions
                  liveJars={effectiveJars}
                  onSelectJar={selectJar}
                  onNavigate={(page) => jarRouter.replace(`/dashboard?page=${page}`, { scroll: false })}
                />
              </div>
            )}

            {/* ── Goals Timeline ──────────────────────────────────────────────── */}
            {effectiveJars.filter(j => j.unlockDate > 0).length > 0 && (
              <V3Timeline liveJars={effectiveJars} />
            )}

            {/* ── Jars section ────────────────────────────────────────────────── */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>Your jars · {effectiveJars.length}</div>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: "#666", cursor: "pointer" }}>All</span>
                  <span style={{ fontSize: 12, color: "#666", cursor: "pointer" }}>Active</span>
                  <span style={{ fontSize: 12, color: "#666", cursor: "pointer" }}>Locked</span>
                  <button onClick={onNewJar} style={{ fontSize: 12, color: "#666", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>+ New</button>
                </div>
              </div>

              {effectiveJars.length > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:"#555" }}>{sortedJars.length} {sortedJars.length === 1 ? "jar" : "jars"}</div>
                  <select
                    value={sortBy}
                    onChange={e => setSortBy(e.target.value as typeof sortBy)}
                    style={{ fontSize:12, color:"#555", border:"1px solid #E0E0DC", borderRadius:7, padding:"4px 8px", background:"#fff", cursor:"pointer", fontFamily:"var(--font)", outline:"none" }}
                  >
                    <option value="recent">Sort: Recent</option>
                    <option value="amount">Sort: Amount</option>
                    <option value="progress">Sort: Progress</option>
                    <option value="unlock">Sort: Unlock date</option>
                  </select>
                </div>
              )}

              {effectiveJars.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Main CTA */}
                  <div style={{ background: "#ECFAF3", borderRadius: 18, padding: "48px 24px", textAlign: "center" }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 20px", boxShadow: "0 2px 8px rgba(0,0,0,.08)" }}>🫙</div>
                    <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 10 }}>Create your first jar</div>
                    <div style={{ fontSize: 14, color: "#555", lineHeight: 1.6, marginBottom: 28, maxWidth: 340, margin: "0 auto 28px" }}>Set aside money for a goal, a date, or a person. It earns yield automatically while you wait.</div>
                    <button onClick={onNewJar} style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#111", color: "#fff", fontSize: 14, fontWeight: 600, padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>+ New jar</button>
                  </div>

                  {/* Templates */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#999", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 10 }}>Or start from a template</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                      {[
                        { emoji: "✈️", bg: "#E2EBF7", label: "Trip fund", sub: "Save for a future trip" },
                        { emoji: "🏡", bg: "#FBF1D6", label: "House down payment", sub: "Toward a home of your own" },
                        { emoji: "👶", bg: "#E5F0E8", label: "Child's future", sub: "A jar that unlocks at 18" },
                        { emoji: "🎁", bg: "#F8E4E4", label: "Group gift", sub: "Pool with friends for someone" },
                      ].map((t) => (
                        <button key={t.label} onClick={onNewJar}
                          style={{ background: "#fff", border: "1px solid #EAEAEA", borderRadius: 14, padding: "18px 14px", textAlign: "left", cursor: "pointer", fontFamily: "var(--font)", transition: "box-shadow .15s" }}
                          onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.07)")}
                          onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                        >
                          <div style={{ width: 40, height: 40, borderRadius: "50%", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, marginBottom: 12 }}>{t.emoji}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4, color: "#111" }}>{t.label}</div>
                          <div style={{ fontSize: 12, color: "#888", lineHeight: 1.4 }}>{t.sub}</div>
                          <div style={{ fontSize: 12, color: "#1F8A5B", fontWeight: 600, marginTop: 10 }}>Use template →</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Feature highlights */}
                  <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #EAEAEA", padding: "20px 24px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                    {[
                      { icon: "📈", label: "Forecast your future", sub: "See how much your jars will grow with a 'what if' calculator." },
                      { icon: "🏆", label: "Earn achievements", sub: "Unlock milestones as you save. 12 to collect." },
                      { icon: "💚", label: "Friends & family help", sub: "Anyone with a link can chip in to your jars." },
                    ].map(f => (
                      <div key={f.label}>
                        <div style={{ fontSize: 24, marginBottom: 8 }}>{f.icon}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{f.label}</div>
                        <div style={{ fontSize: 12, color: "#888", lineHeight: 1.5 }}>{f.sub}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="jar-cards-grid" style={{ display: "grid", gap: 12 }}>
                  {sortedJars.map((j) => (
                    <V2JarCard
                      key={j.id}
                      jar={j}
                      onSelect={() => selectJar(j)}
                      onAddFunds={(e) => { e.stopPropagation(); onAddFunds(j.id, j.name, j.currency as "usdc" | "sol"); }}
                    />
                  ))}
                  <V2AddJarCard onClick={onNewJar} />
                </div>
              )}
            </div>

            {/* ── Monthly chart + Achievements ────────────────────────────────── */}
            {effectiveJars.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <V3MonthlyChart contributions={effectiveContribs} />
                <V3Achievements liveJars={effectiveJars} contributions={effectiveContribs} />
              </div>
            )}

            {/* ── Contributors + Activity ──────────────────────────────────────── */}
            {effectiveJars.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <V3Contributors contributions={effectiveContribs} />
                <V3Activity contributions={effectiveContribs} liveJars={effectiveJars} />
              </div>
            )}

        </>
      </div>

      <style>{`
        .jar-cards-grid { grid-template-columns: repeat(3, 1fr); }
        @media (max-width: 1100px) { .jar-cards-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 640px)  { .jar-cards-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V2 DASHBOARD HELPER COMPONENTS
// ---------------------------------------------------------------------------

function V2HeroStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div style={{ borderLeft: "1px solid #F0F0EE", paddingLeft: 24 }}>
      <div style={{ fontSize: 11, color: "#666", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em", color: accent ? "#1F8A5B" : "#111" }}>{value}</div>
      <div style={{ fontSize: 11, color: "#999", marginTop: 3 }}>{sub}</div>
    </div>
  );
}

function makeSparkline(w: number, h: number): string {
  const pts = 16;
  const coords = Array.from({ length: pts }, (_, i) => {
    const x = (i / (pts - 1)) * w;
    const t = i / (pts - 1);
    const y = h - Math.pow(t, 1.3) * h * 0.72 - Math.sin(t * 7) * h * 0.07;
    return `${x.toFixed(1)},${Math.max(0, Math.min(h, y)).toFixed(1)}`;
  });
  return `M ${coords.join(" L ")}`;
}

// Stable pastel colours for jar avatars derived from name
const AVATAR_COLORS = ["#D4EAE0","#D8E8F5","#F5E8D4","#EAD4EA","#F5D4D4","#D4EAF5","#EAF5D4","#F5F0D4"];
function jarAvatarColor(name: string) { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff; return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

function V2JarCard({ jar, onSelect, onAddFunds }: { jar: JarType; onSelect: () => void; onAddFunds: (e: React.MouseEvent) => void }) {
  const pct = jar.goal > 0 ? Math.min(100, (jar.amount / jar.goal) * 100) : 0;
  const future = jar.futureValue ?? jar.amount;
  const gain = future - jar.amount;

  const imageKey: JarImageKey = jar.image ?? "gift";
  const tint = JAR_IMAGE_TINTS[imageKey] ?? { bg: "#EAF4EE", illo: "#1F8A5B" };
  const svgMarkup = JAR_SVGS[imageKey] ?? "";

  const progressLabel = jar.goal > 0
    ? `${Math.round(pct)}% of $${jar.goal.toLocaleString()}`
    : jar.unlockDate > 0
    ? `${Math.round(pct)}% of timeline`
    : "Open jar";

  // Sparkline
  const sparkPts = 24;
  const sparkArr: number[] = [];
  for (let i = 0; i <= sparkPts; i++) {
    const x = i / sparkPts;
    sparkArr.push(jar.amount * (Math.pow(x, 1.4) + Math.sin(x * 8) * 0.04 * x));
  }
  const sparkMax = Math.max(...sparkArr, 1);
  const SW = 100, SH = 32;
  const sparkPath = sparkArr.map((v, i) => `${(i / sparkPts) * SW},${SH - (v / sparkMax) * (SH - 4) - 2}`).join(" L ");

  return (
    <div
      onClick={onSelect}
      style={{ background: "#fff", borderRadius: 14, border: "1px solid #EAEAEA", padding: "16px 18px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12, transition: "box-shadow .15s" }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.07)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      {/* Top: illustration circle + name + lock */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          background: tint.bg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0, overflow: "hidden", color: tint.illo,
        }}>
          {jar.customImage
            ? <img src={jar.customImage} alt="" style={{ width: 44, height: 44, objectFit: "cover" }} />
            : <div style={{ width: 34, height: 34, color: tint.illo }} dangerouslySetInnerHTML={{ __html: svgMarkup.replace(/<svg/, `<svg style="width:34px;height:34px"`) }} />
          }
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{jar.name}</div>
          <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
            {jar.unlockDate > 0
              ? `Unlocks ${new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
              : jar.goal > 0 ? `Goal $${jar.goal.toLocaleString()}` : "Open"}
          </div>
        </div>
        {jar.locked && <span style={{ fontSize: 13, opacity: 0.4 }}>🔒</span>}
      </div>

      {/* Amount + sparkline */}
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1 }}>
            ${jar.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          {gain > 0.01 && (
            <div style={{ fontSize: 11, color: "#1F8A5B", marginTop: 4 }}>→ ${Math.round(future).toLocaleString()}</div>
          )}
        </div>
        <svg viewBox={`0 0 ${SW} ${SH}`} style={{ width: 100, height: 32 }}>
          <path d={`M 0,${SH} L ${sparkPath} L ${SW},${SH} Z`} fill="#1F8A5B" fillOpacity="0.08" />
          <path d={`M ${sparkPath}`} fill="none" stroke="#1F8A5B" strokeWidth="1.5" />
        </svg>
      </div>

      {/* Progress info */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#999", marginBottom: 4 }}>
          <span>{progressLabel}</span>
          <span>You</span>
        </div>
        <div style={{ height: 3, borderRadius: 3, background: "#F0F0EE", overflow: "hidden" }}>
          <div style={{ height: "100%", borderRadius: 3, background: "#1F8A5B", width: `${pct}%`, transition: "width .3s" }} />
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
        <button
          onClick={onAddFunds}
          style={{ fontSize: 11, fontWeight: 600, padding: "5px 12px", background: "#111", color: "#fff", border: "none", borderRadius: 7, cursor: "pointer", fontFamily: "var(--font)" }}
        >
          + Add
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
          style={{ fontSize: 11, fontWeight: 500, padding: "5px 12px", background: "transparent", color: "#555", border: "1px solid #E0E0E0", borderRadius: 7, cursor: "pointer", fontFamily: "var(--font)" }}
        >
          Share
        </button>
      </div>
    </div>
  );
}

function V2AddJarCard({ onClick }: { onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ background: "transparent", borderRadius: 14, border: "1.5px dashed #D8D8D4", padding: 16, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 160, transition: "border-color .15s, background .15s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "#111"; e.currentTarget.style.background = "#fff"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "#D8D8D4"; e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#F4F4F1", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>+</div>
      <div style={{ fontSize: 12, color: "#999", fontWeight: 500 }}>New jar</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 HERO
// ---------------------------------------------------------------------------

function V3Hero({
  totalSaved,
  totalFutureValue,
  totalYieldEarned,
  estimatedYieldMonthly,
  uniqueContributors,
  liveJars,
  apy,
}: {
  totalSaved: number;
  totalFutureValue: number;
  totalYieldEarned: number;
  estimatedYieldMonthly: number;
  uniqueContributors: number;
  liveJars: JarType[];
  apy: { usdc_kamino: number; sol_marinade: number };
}) {
  const gain = totalFutureValue - totalSaved;
  const fmt = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const avgApyPct = ((apy.usdc_kamino + apy.sol_marinade) / 2).toFixed(1);
  const fmtCents = (v: number) => `$${v.toFixed(2)}`;

  return (
    <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #EAEAEA", padding: "28px 32px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, color: "#666", fontWeight: 500, marginBottom: 8 }}>Your jars will grow to</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <div style={{ fontSize: 56, fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1, color: "#111" }}>
              {fmt(totalFutureValue)}
            </div>
            {gain > 0 && (
              <div style={{ fontSize: 14, color: "#1F8A5B", fontWeight: 500, background: "#EAF4EE", padding: "4px 10px", borderRadius: 999 }}>
                +{fmt(gain)}
              </div>
            )}
          </div>
          <div style={{ fontSize: 14, color: "#666", marginTop: 12 }}>
            Saving <strong style={{ color: "#111" }}>{fmt(totalSaved)}</strong> today across {liveJars.length} jar{liveJars.length !== 1 ? "s" : ""} · earning <strong style={{ color: "#1F8A5B" }}>~{avgApyPct}%/yr</strong> automatically
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, paddingLeft: 24, borderLeft: "1px solid #F0F0EE", flexWrap: "wrap" }}>
          <V3HeroStat label="Earned this year" value={fmtCents(totalYieldEarned)} accent />
          <V3HeroStat label="Earning per month" value={fmtCents(estimatedYieldMonthly)} />
          <V3HeroStat label="People helping" value={String(uniqueContributors || 0)} sub={`across ${liveJars.filter(j => j.goal > 0).length} jars`} />
          <V3HeroStat label="Streak" value="18 days" sub="longest: 45 days" />
        </div>
      </div>
    </div>
  );
}

function V3HeroStat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#666", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.02em", color: accent ? "#1F8A5B" : "#111" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 FORECAST
// ---------------------------------------------------------------------------

function V3Forecast({
  totalSaved,
  apy,
  schedules,
  jars,
}: {
  totalSaved: number;
  apy: { usdc_kamino: number; sol_marinade: number };
  schedules: Schedule[];
  jars: JarType[];
}) {
  const APY = (apy.usdc_kamino + apy.sol_marinade) / 2 / 100;

  // Real monthly from active schedules (amount_usdc is in cents)
  const totalMonthly = schedules
    .filter(s => s.active)
    .reduce((sum, s) => {
      const mo = s.frequency === "weekly" ? (s.amount_usdc / 100) * 4.33 : s.amount_usdc / 100;
      return sum + mo;
    }, 0);

  // Time horizon: furthest unlock date among jars, min 3y, max 20y
  const nowSec = Date.now() / 1000;
  const maxUnlock = jars.reduce((max, j) => Math.max(max, j.unlockDate ?? 0), 0);
  const yearsFromJars = maxUnlock > nowSec ? (maxUnlock - nowSec) / (365.25 * 24 * 3600) : 0;
  const years = Math.min(20, Math.max(3, Math.round(yearsFromJars) || 5));

  // Total goals across all jars
  const totalGoal = jars.reduce((sum, j) => sum + (j.goal ?? 0), 0);

  function forecastSeries(mo: number, yrs: number, rate: number, principal: number, pts: number): number[] {
    const arr: number[] = [];
    const r = rate / 12;
    let bal = principal;
    for (let i = 0; i <= pts; i++) {
      arr.push(bal);
      const step = Math.ceil((yrs * 12) / pts);
      for (let s = 0; s < step; s++) bal = bal * (1 + r) + mo;
    }
    return arr;
  }

  const final = calcForecast(totalSaved, totalMonthly, years, APY * 100);
  const series = forecastSeries(totalMonthly, years, APY, totalSaved, 60);
  const bankSeries = forecastSeries(totalMonthly, years, 0.005, totalSaved, 60);
  const bankFinal = bankSeries[bankSeries.length - 1];
  const yieldGain = Math.max(0, final - totalSaved - totalMonthly * 12 * years);

  const maxVal = Math.max(...series, totalGoal, 1);
  const W = 700, H = 200;
  const pathFor = (arr: number[]) =>
    arr.map((v, i) => `${(i / (arr.length - 1)) * W},${H - (v / maxVal) * (H - 14) - 4}`).join(" L ");
  const goalY = totalGoal > 0 ? H - (totalGoal / maxVal) * (H - 14) - 4 : null;

  const fmt = (v: number) => `$${Math.round(v).toLocaleString()}`;

  const hasSchedules = totalMonthly > 0;

  return (
    <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "22px 26px" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Forecast</div>
        <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>
          Your savings plan
        </div>
      </div>

      <div style={{ display: "flex", gap: 30, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, color: "#666", fontWeight: 500, marginBottom: 4 }}>You&apos;ll have</div>
          <div style={{ fontSize: 38, fontWeight: 600, letterSpacing: "-0.035em", lineHeight: 1, color: "#1F8A5B" }}>{fmt(final)}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>in {years} years</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#666", fontWeight: 500, marginBottom: 4 }}>Yield earnings</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1, marginTop: 8 }}>{fmt(yieldGain)}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>at {(APY * 100).toFixed(1)}% avg APY</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: "#666", fontWeight: 500, marginBottom: 4 }}>vs. bank (0.5%)</div>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1, marginTop: 8 }}>+{fmt(Math.max(0, final - bankFinal))}</div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>extra earnings</div>
        </div>
        {hasSchedules && (
          <div>
            <div style={{ fontSize: 11, color: "#666", fontWeight: 500, marginBottom: 4 }}>Monthly deposits</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em", lineHeight: 1, marginTop: 8 }}>{fmt(totalMonthly)}/mo</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 6 }}>across {schedules.filter(s => s.active).length} schedule{schedules.filter(s => s.active).length !== 1 ? "s" : ""}</div>
          </div>
        )}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 200, display: "block" }}>
        <defs>
          <linearGradient id="v3grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1F8A5B" stopOpacity="0.22" />
            <stop offset="1" stopColor="#1F8A5B" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map(p => (
          <line key={p} x1="0" y1={H * p} x2={W} y2={H * p} stroke="#F0F0EE" strokeWidth="1" strokeDasharray="2 4" />
        ))}
        {[Math.round(years / 4), Math.round(years / 2), Math.round(years * 3 / 4), years].map((y, i) => (
          <text key={i} x={(y / years) * W} y={H - 2} fontSize="9" fill="#999" textAnchor="middle">{y}y</text>
        ))}
        {goalY !== null && (
          <>
            <line x1="0" y1={goalY} x2={W} y2={goalY} stroke="#F59E0B" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x={W - 4} y={goalY - 4} fontSize="9" fill="#F59E0B" textAnchor="end">goal {fmt(totalGoal)}</text>
          </>
        )}
        <path d={`M ${pathFor(bankSeries)}`} fill="none" stroke="#999" strokeWidth="1.5" strokeDasharray="3 3" />
        <path d={`M 0,${H} L ${pathFor(series)} L ${W},${H} Z`} fill="url(#v3grad)" />
        <path d={`M ${pathFor(series)}`} fill="none" stroke="#1F8A5B" strokeWidth="2.5" />
        <circle cx={W} cy={H - (final / maxVal) * (H - 14) - 4} r="5" fill="#1F8A5B" />
      </svg>

      {!hasSchedules && (
        <div style={{ marginTop: 12, fontSize: 12, color: "#999", textAlign: "center" }}>
          Set up recurring deposits to see your full savings plan
        </div>
      )}
    </div>
  );
}

function V3TabBtn({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 12px", fontSize: 12, fontWeight: 500,
      background: active ? "#fff" : "transparent",
      color: active ? "#111" : "#666",
      border: "none", borderRadius: 7, cursor: "pointer",
      boxShadow: active ? "0 1px 3px rgba(0,0,0,0.06)" : "none",
      fontFamily: "var(--font)",
    }}>{children}</button>
  );
}

function V3SliderRow({ label, displayVal, min, max, step, val, setVal }: {
  label: string; displayVal: string; min: number; max: number; step: number; val: number; setVal: (v: number) => void;
}) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666", marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 600, color: "#111" }}>{displayVal}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={val}
        onChange={e => setVal(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#1F8A5B", cursor: "pointer" }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 SUGGESTIONS
// ---------------------------------------------------------------------------

function V3Suggestions({
  liveJars,
  onSelectJar,
  onNavigate,
}: {
  liveJars: JarType[];
  onSelectJar: (jar: JarType) => void;
  onNavigate: (page: "dashboard" | "analytics" | "contributors" | "demo") => void;
}) {
  const topJar = liveJars[0];
  const recs = [
    {
      id: 1,
      title: topJar ? `Add monthly contributions to "${topJar.name}"` : "Set up monthly contributions",
      impact: "+$8,400 by 2034",
      emoji: "💡",
      cta: "Set up",
      onClick: () => topJar && onSelectJar(topJar),
    },
    {
      id: 2,
      title: "Check your savings timeline",
      impact: "See projected jar values",
      emoji: "📈",
      cta: "View",
      onClick: () => onNavigate("analytics"),
    },
    {
      id: 3,
      title: "Share your gift link",
      impact: "Let friends & family contribute",
      emoji: "💚",
      cta: "Share",
      onClick: () => {
        if (topJar) {
          const url = `${typeof window !== "undefined" ? window.location.origin : "https://jarfi.xyz"}/gift/${topJar.id}`;
          navigator.clipboard.writeText(url).catch(() => {});
        }
      },
    },
  ];
  return (
    <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "20px 22px" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>For you</div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>Suggestions</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {recs.map(r => (
          <div key={r.id} style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "12px 14px",
            background: "#F7F8F7", borderRadius: 12,
          }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>{r.emoji}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{r.title}</div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{r.impact}</div>
            </div>
            <button onClick={r.onClick} style={{ padding: "6px 12px", background: "#111", color: "#fff", border: "none", borderRadius: 8, fontSize: 11, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)", flexShrink: 0 }}>{r.cta}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 GOALS TIMELINE
// ---------------------------------------------------------------------------

function V3Timeline({ liveJars }: { liveJars: JarType[] }) {
  const now = Date.now() / 1000;
  const dated = liveJars
    .filter(j => j.unlockDate > 0)
    .sort((a, b) => a.unlockDate - b.unlockDate);

  if (dated.length === 0) return null;

  const minDate = now;
  const maxDate = Math.max(...dated.map(j => j.unlockDate));
  const range = maxDate - minDate || 1;
  const nearest = dated[0];

  return (
    <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "20px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Goals timeline</div>
          <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em" }}>When jars unlock</div>
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>
          Next: {nearest.name} · {new Date(nearest.unlockDate * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
        </div>
      </div>

      <div style={{ position: "relative", height: 90, marginTop: 24 }}>
        {/* axis line */}
        <div style={{ position: "absolute", top: 44, left: 0, right: 0, height: 2, background: "#F0F0EE", borderRadius: 2 }} />
        {/* Now dot */}
        <div style={{ position: "absolute", top: 34, left: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#111", border: "2px solid #fff", boxShadow: "0 0 0 1px #111", marginTop: 6 }} />
          <div style={{ fontSize: 10, color: "#666", marginTop: 4 }}>Now</div>
        </div>

        {dated.map((jar, i) => {
          const pct = ((jar.unlockDate - minDate) / range) * 94 + 3;
          const above = i % 2 === 0;
          return (
            <div key={jar.id} style={{
              position: "absolute",
              left: `${pct}%`,
              top: above ? 0 : 52,
              transform: "translateX(-50%)",
              display: "flex",
              flexDirection: above ? "column-reverse" : "column",
              alignItems: "center",
              gap: 4,
            }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#1F8A5B", border: "2px solid #fff", boxShadow: "0 0 0 1px #1F8A5B" }} />
              <div style={{
                background: "#EAF4EE", color: "#0f5e3d",
                padding: "4px 8px", borderRadius: 6,
                fontSize: 10, fontWeight: 600, whiteSpace: "nowrap",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 1,
              }}>
                <div>{jar.name}</div>
                <div style={{ fontSize: 9, fontWeight: 500, opacity: 0.7 }}>{new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 MONTHLY CHART
// ---------------------------------------------------------------------------

function V3MonthlyChart({ contributions }: { contributions: JarContribution[] }) {
  if (contributions.length === 0) return null;

  const byMonth: Record<string, number> = {};
  contributions.forEach(c => {
    const d = new Date(c.createdAt * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMonth[key] = (byMonth[key] || 0) + c.amount / 1_000_000;
  });

  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: d.toLocaleDateString("en-US", { month: "short" }), value: byMonth[key] || 0 };
  }).filter(m => Object.keys(byMonth).some(k => k <= m.key));

  if (months.every(m => m.value === 0)) return null;

  const max = Math.max(...months.map(m => m.value), 1);
  const total = months.reduce((s, m) => s + m.value, 0);
  const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${Math.round(v)}`;

  // SVG dimensions
  const W = 460, H = 72, PAD_X = 24, PAD_Y = 8;
  const n = months.length;
  const xs = months.map((_, i) => PAD_X + (i / Math.max(n - 1, 1)) * (W - PAD_X * 2));
  const ys = months.map(m => PAD_Y + (1 - m.value / max) * (H - PAD_Y * 2));
  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(" ");

  return (
    <div style={{ background:"#fff", borderRadius:18, border:"1px solid #EAEAEA", padding:"20px 22px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:11, color:"#888", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Contributions</div>
          <div style={{ fontSize:14, fontWeight:600 }}>{fmt(total)} received</div>
        </div>
        <div style={{ fontSize:11, color:"#bbb" }}>Last {months.length} months</div>
      </div>

      {/* SVG line + dots chart */}
      <div style={{ position:"relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:"100%", height:H, overflow:"visible" }}>
          {/* Zero baseline */}
          <line x1={PAD_X} y1={H - PAD_Y} x2={W - PAD_X} y2={H - PAD_Y} stroke="#F0F0EE" strokeWidth={1} />
          {/* Line */}
          <polyline points={polyline} fill="none" stroke="#1F8A5B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
          {/* Dots + labels */}
          {months.map((m, i) => (
            <g key={m.key}>
              {/* Value label */}
              {m.value > 0 && (
                <text x={xs[i]} y={ys[i] - 8} textAnchor="middle" fontSize={9} fill="#888" fontFamily="var(--font)" fontWeight={500}>
                  {fmt(m.value)}
                </text>
              )}
              {/* Dot */}
              <circle cx={xs[i]} cy={ys[i]} r={m.value > 0 ? 3.5 : 2} fill={m.value > 0 ? "#1F8A5B" : "#E0E0DC"} />
            </g>
          ))}
        </svg>
        {/* Month labels */}
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, paddingLeft: PAD_X, paddingRight: PAD_X }}>
          {months.map(m => (
            <div key={m.key} style={{ fontSize:10, color:"#bbb", textAlign:"center", flex:1 }}>{m.label}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 ACHIEVEMENTS
// ---------------------------------------------------------------------------

function V3Achievements({ liveJars, contributions }: { liveJars: JarType[]; contributions: JarContribution[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const totalSaved = liveJars.reduce((s, j) => s + j.amount, 0);
  const uniqueContribs = new Set(contributions.map(c => c.contributor)).size;
  const jarTypes = new Set(liveJars.map(j => j.jarType));
  const now = Math.floor(Date.now() / 1000);

  const ach = [
    { id:"first_jar",    icon:"🥚", label:"First step",    desc:"Created your first jar",                      earned: liveJars.length > 0 },
    { id:"goal_jar",     icon:"🎯", label:"Goal setter",   desc:"Created a Goal jar",                          earned: liveJars.some(j => j.jarType === "GOAL") },
    { id:"date_jar",     icon:"📅", label:"Time lock",     desc:"Created a Date jar",                          earned: liveJars.some(j => j.jarType === "DATE") },
    { id:"shared_jar",   icon:"🎁", label:"Gift giver",    desc:"Created a Shared or Gift jar",                earned: liveJars.some(j => j.jarType === "SHARED") },
    { id:"funded",       icon:"💰", label:"Funded",        desc:"Your jar has a balance",                      earned: liveJars.some(j => j.amount > 0) },
    { id:"century",      icon:"💯", label:"Century",       desc:"Saved over $100 total",                       earned: totalSaved >= 100 },
    { id:"high_roller",  icon:"🚀", label:"High roller",   desc:"Saved over $1,000 total",                     earned: totalSaved >= 1000 },
    { id:"popular",      icon:"👥", label:"Popular",       desc:"3 or more unique contributors",               earned: uniqueContribs >= 3 },
    { id:"sharer",       icon:"🔗", label:"Sharer",        desc:"Shared a gift link for your jar",             earned: liveJars.length > 0 },
    { id:"goal_reached", icon:"🏆", label:"Goal reached",  desc:"Reached the savings goal on a jar",           earned: liveJars.some(j => j.goal > 0 && j.amount >= j.goal) },
    { id:"diversified",  icon:"🌍", label:"Diversified",   desc:"Have 3 or more different jar types",          earned: jarTypes.size >= 3 },
    { id:"time_up",      icon:"⌛", label:"Time's up",     desc:"A date jar's unlock date has arrived",        earned: liveJars.some(j => j.jarType === "DATE" && j.unlockDate > 0 && j.unlockDate <= now) },
  ];

  const earnedCount = ach.filter(a => a.earned).length;
  const selectedAch = ach.find(a => a.id === selected);

  return (
    <div style={{ background:"#fff", borderRadius:18, border:"1px solid #EAEAEA", padding:"20px 22px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:16 }}>
        <div>
          <div style={{ fontSize:11, color:"#888", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:4 }}>Achievements</div>
          <div style={{ fontSize:14, fontWeight:600 }}>{earnedCount} of 12 unlocked</div>
        </div>
        {earnedCount > 0 && <div style={{ fontSize:12, color:"#1F8A5B", fontWeight:500 }}>{Math.round(earnedCount/12*100)}% done</div>}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:8 }}>
        {ach.map(a => (
          <button
            key={a.id}
            onClick={() => setSelected(selected === a.id ? null : a.id)}
            title={a.earned ? a.label : "???"}
            style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, padding:"8px 4px", borderRadius:10, border:"none", background: a.earned ? "#ECFDF5" : "#F4F4F1", cursor:"pointer", transition:"opacity .2s, background .2s", fontFamily:"var(--font)" }}
          >
            <div style={{ fontSize:20 }}>{a.earned ? a.icon : "🔒"}</div>
            <div style={{ fontSize:9, fontWeight:600, color: a.earned ? "#1F8A5B" : "#bbb", textAlign:"center", lineHeight:1.2 }}>
              {a.earned ? a.label : "???"}
            </div>
          </button>
        ))}
      </div>
      {selectedAch && (
        <div style={{ marginTop:12, padding:"10px 14px", background: selectedAch.earned ? "#ECFDF5" : "#F4F4F1", borderRadius:10, display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:20 }}>{selectedAch.earned ? selectedAch.icon : "🔒"}</span>
          <div>
            <div style={{ fontSize:12, fontWeight:600, color: selectedAch.earned ? "#1F8A5B" : "#555" }}>
              {selectedAch.earned ? selectedAch.label : "Secret achievement"}
            </div>
            <div style={{ fontSize:11, color:"#777", marginTop:2 }}>
              {selectedAch.earned ? selectedAch.desc : "Keep saving to unlock this achievement"}
            </div>
          </div>
          {selectedAch.earned && <div style={{ marginLeft:"auto", fontSize:11, fontWeight:700, color:"#1F8A5B" }}>✓</div>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 CONTRIBUTORS LEADERBOARD
// ---------------------------------------------------------------------------

const CONTRIB_COLORS = ["#1F8A5B", "#B07D2A", "#B0405E", "#3B5BA5", "#5C4B8A"];

function V3Contributors({ contributions }: { contributions: JarContribution[] }) {
  const byAddr = new Map<string, number>();
  contributions.forEach(c => {
    byAddr.set(c.contributor, (byAddr.get(c.contributor) ?? 0) + c.amount / 1_000_000);
  });
  const sorted = [...byAddr.entries()]
    .map(([addr, total]) => ({ addr, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxTotal = sorted[0]?.total || 1;

  if (sorted.length === 0) {
    return (
      <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "20px 22px" }}>
        <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Top contributors</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>0 people helping</div>
        <div style={{ fontSize: 13, color: "#999", padding: "20px 0", textAlign: "center" }}>Share your jar link to invite contributions</div>
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Top contributors</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{sorted.length} people helping</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {sorted.map((c, i) => {
          const color = CONTRIB_COLORS[i % CONTRIB_COLORS.length];
          const initials = c.addr.slice(0, 2).toUpperCase();
          const name = `${c.addr.slice(0, 4)}…${c.addr.slice(-4)}`;
          return (
            <div key={c.addr} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ fontSize: 11, color: "#999", width: 14, fontVariantNumeric: "tabular-nums" }}>{i + 1}</div>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{initials}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{DEMO_NAMES[c.addr] ?? name}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, fontVariantNumeric: "tabular-nums", color: "#1F8A5B" }}>${c.total.toFixed(0)}</div>
                </div>
                <div style={{ height: 2, background: "#F0F0EE", borderRadius: 1, marginTop: 5, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(c.total / maxTotal) * 100}%`, background: color, borderRadius: 1, opacity: 0.7 }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// V3 ACTIVITY
// ---------------------------------------------------------------------------

function V3Activity({ contributions, liveJars }: { contributions: JarContribution[]; liveJars: JarType[] }) {
  const sorted = [...contributions].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  function timeAgo(ts: number) {
    const s = Math.floor(Date.now() / 1000 - ts);
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  void liveJars;

  return (
    <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "20px 22px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>Recent</div>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Activity</div>
        </div>
        <div style={{ fontSize: 12, color: "#666" }}>Last 7 days</div>
      </div>
      {sorted.length === 0 ? (
        <div style={{ fontSize: 13, color: "#999", padding: "20px 0", textAlign: "center" }}>No recent activity</div>
      ) : (
        sorted.map((c, i) => {
          const displayName = DEMO_NAMES[c.contributor] ?? `${c.contributor.slice(0, 4)}…${c.contributor.slice(-4)}`;
          const ago = timeAgo(c.createdAt);
          return (
            <div key={c.pubkey} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0",
              borderBottom: i < sorted.length - 1 ? "1px solid #F0F0EE" : "none",
            }}>
              <div style={{ width: 26, height: 26, borderRadius: 8, background: "#EAF4EE", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>💝</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{displayName} contributed</div>
                {c.comment && <div style={{ fontSize: 11, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>&quot;{c.comment.slice(0, 40)}&quot;</div>}
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, flexShrink: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1F8A5B" }}>+${(c.amount / 1_000_000).toFixed(2)}</div>
                <div style={{ fontSize: 11, color: "#999" }}>{ago}</div>
              </div>
            </div>
          );
        })
      )}
    </div>
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

  const uniqueContributors = new Set(contributions.map((c) => c.contributor)).size;

  return (
    <div style={{ background: "#F4F4F1", flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-black/5 bg-[#F4F4F1] px-4 py-3 md:hidden">
        <button onClick={onMenuToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="#111" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.3px" }}>jarfi</div>
        <WalletButton compact />
      </div>

      <div style={{ padding: "20px 24px 40px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 3 }}>Insights</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em" }}>Analytics</div>
          </div>
          <button onClick={onBack} style={{ fontSize: 13, fontWeight: 500, color: "#666", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
            ← Dashboard
          </button>
        </div>

        {/* Stats strip */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "22px 26px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {[
            { label: "Total saved", value: `$${totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, sub: "across all jars" },
            { label: "Staking earned (est.)", value: `~$${estimatedStaking.toFixed(2)}/yr`, sub: `Kamino ${apy.usdc_kamino}%` },
            { label: "Family contributed", value: `$${familyContributed.toFixed(2)}`, sub: `${uniqueContributors} contributors` },
            { label: "Total deposits", value: String(depositsCount), sub: "on-chain transactions" },
          ].map((s, i) => (
            <div key={s.label} style={{ borderLeft: i > 0 ? "1px solid #F0F0EE" : "none", paddingLeft: i > 0 ? 20 : 0 }}>
              <div style={{ fontSize: 11, color: "#666", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 11, color: "#999", marginTop: 3 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "20px 22px" }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, letterSpacing: "-0.02em" }}>All transactions</div>
          {sortedContribs.length === 0 ? (
            <div style={{ fontSize: 13, color: "#999", padding: "24px 0", textAlign: "center" }}>
              No transactions yet. Share your gift link 🎁
            </div>
          ) : (
            sortedContribs.map((c) => {
              const ago = (() => {
                const s = Math.floor(Date.now() / 1000 - c.createdAt);
                if (s < 3600) return `${Math.floor(s / 60)}m ago`;
                if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
                return `${Math.floor(s / 86400)}d ago`;
              })();
              return (
                <div key={c.pubkey} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0F0EE" }}>
                  <div style={{ width: 26, height: 26, borderRadius: 8, background: "#F7F8F7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0 }}>💝</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{c.contributor.slice(0, 4)}…{c.contributor.slice(-4)}</div>
                    <div style={{ fontSize: 11, color: "#999" }}>{c.comment ? `"${c.comment.slice(0, 50)}" · ` : ""}{ago}</div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1F8A5B", flexShrink: 0 }}>+${(c.amount / 1_000_000).toFixed(2)}</div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
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

  return (
    <div style={{ background: "#F4F4F1", flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-black/5 bg-[#F4F4F1] px-4 py-3 md:hidden">
        <button onClick={onMenuToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="#111" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.3px" }}>jarfi</div>
        <WalletButton compact />
      </div>

      <div style={{ padding: "20px 24px 40px", display: "flex", flexDirection: "column", gap: 16, flex: 1 }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, color: "#666", marginBottom: 3 }}>Insights</div>
            <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.025em" }}>
              Contributors{uniqueAddrs.length > 0 ? ` · ${uniqueAddrs.length}` : ""}
            </div>
          </div>
          <button onClick={onBack} style={{ fontSize: 13, fontWeight: 500, color: "#666", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
            ← Dashboard
          </button>
        </div>

        {contributions.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "64px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎁</div>
            <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: "-0.02em", marginBottom: 8 }}>No contributions yet</div>
            <div style={{ fontSize: 13, color: "#666" }}>Share your gift link to start collecting</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Contributors list */}
            <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "20px 22px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, letterSpacing: "-0.02em" }}>
                All contributors · ${total.toFixed(2)} total
              </div>
              {contributions.slice(0, 10).map((c) => (
                <div key={c.pubkey} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #F0F0EE" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#1F8A5B", flexShrink: 0 }}>
                    {c.contributor.slice(0, 2).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{c.contributor.slice(0, 4)}…{c.contributor.slice(-4)}</div>
                    {c.comment && <div style={{ fontSize: 11, color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>"{c.comment.slice(0, 40)}"</div>}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1F8A5B", flexShrink: 0 }}>+${(c.amount / 1_000_000).toFixed(2)}</div>
                </div>
              ))}
            </div>

            {/* Breakdown */}
            <div style={{ background: "#fff", borderRadius: 18, border: "1px solid #EAEAEA", padding: "20px 22px" }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, letterSpacing: "-0.02em" }}>Share breakdown</div>
              {breakdown.map((r) => (
                <div key={r.addr} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                    <span style={{ fontFamily: "monospace", color: "#444" }}>{r.addr.slice(0, 4)}…{r.addr.slice(-4)}</span>
                    <span style={{ fontWeight: 600 }}>{r.pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 6, background: "#F0F0EE", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 6, background: "#1F8A5B", width: `${r.pct}%`, transition: "width .3s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DEMO PAGE
// ---------------------------------------------------------------------------

function DemoPage({
  apy,
  onMenuToggle,
  onAddFunds,
}: {
  apy: { usdc_kamino: number; sol_marinade: number };
  onMenuToggle: () => void;
  onAddFunds: (pubkey: string, name: string, currency: "usdc" | "sol") => void;
}) {
  const [scenario, setScenario] = useState(100);
  return (
    <DashboardPage
      onNewJar={() => {}}
      scenario={scenario}
      setScenario={setScenario}
      liveJars={DEMO_JARS}
      greeting="demo"
      apy={apy}
      schedules={[]}
      onStopSchedule={async () => {}}
      onScheduleUpdate={() => {}}
      groups={[]}
      contributions={DEMO_CONTRIBUTIONS}
      onMenuToggle={onMenuToggle}
      onAddFunds={onAddFunds}
      onJarBroken={() => {}}
    />
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

function resizeImageFile(file: File, maxPx = 640): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxPx || h > maxPx) {
        if (w > h) { h = Math.round(h * maxPx / w); w = maxPx; }
        else { w = Math.round(w * maxPx / h); h = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.src = url;
  });
}

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
    jarImage: JarImageKey | null;
    customImage: string | null;
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
  const [jarImage, setJarImage] = useState<JarImageKey | null>(null);
  const [customImageDataUrl, setCustomImageDataUrl] = useState<string | null>(null);
  const [customImageName, setCustomImageName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Goal
  const [goalInput, setGoalInput] = useState("");

  // Date
  const [selectedYears, setSelectedYears] = useState<number | null>(5);
  const [customDate, setCustomDate] = useState("");

  // Reminder
  const [reminderChoice, setReminderChoice] = useState<"monthly" | "none">("none");
  const [reminderAmount, setReminderAmount] = useState("100");
  const [reminderDay, setReminderDay] = useState(1);
  const [reminderHour, setReminderHour] = useState(9);

  // Security
  const [approvalMode, setApprovalMode] = useState<"NONE" | "FAMILY_APPROVAL">("NONE");

  const [submitting, setSubmitting] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

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
    if ((selectedType === "GOAL" || selectedType === "GOAL_BY_DATE") && goalUsd <= 0) return;
    setSubmitting(true);
    setTxError(null);
    try {
      const unlockDate = customDate
        ? Math.floor(new Date(customDate).getTime() / 1000)
        : selectedYears
        ? Math.floor(Date.now() / 1000 + selectedYears * 365.25 * 86400)
        : 0;
      const goalAmount = goalUsd > 0 ? Math.round(goalUsd * 1_000_000) : 0;
      const { mode, contractUnlockDate, contractGoal } = jarTypeToContract(selectedType, unlockDate, goalAmount);

      const recurring = isReminder && monthly > 0
        ? { amount_usdc: Math.round(monthly * 100), frequency: "monthly" as const, day: reminderDay, hour: reminderHour, minute: 0 }
        : null;

      await onCreate({ jarName, jarEmoji, jarImage, customImage: customImageDataUrl, mode, unlockDate: contractUnlockDate, goalAmount: contractGoal, currency: "usdc", recurring, groupTrip: null, approvalMode });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setTxError(
        msg.includes("blockhash") || msg.includes("congested") || msg.includes("congestion")
          ? "Network busy — tap 'Retry'"
          : msg.includes("rejected") || msg.includes("User rejected")
          ? "Transaction cancelled — tap 'Create jar' to try again"
          : msg.includes("insufficient") || msg.includes("lamports")
          ? "Not enough SOL for fees"
          : "Transaction failed — tap 'Create jar' to retry"
      );
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

        {/* ── STEP: image ── */}
        {step === "image" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-tertiary)", letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 8 }}>
                {selectedType && `${JAR_TYPE_ICONS[selectedType]} ${JAR_TYPE_LABELS[selectedType]}`}
              </div>
              <div style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.6px" }}>Add a cover photo</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>Appears on your jar card and gift page.</div>
            </div>

            {/* Upload zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: customImageDataUrl ? "2px solid #1F8A5B" : "2px dashed #D0D0CC",
                borderRadius: 16,
                background: customImageDataUrl ? "#F0FAF5" : "#FAFAF8",
                cursor: "pointer",
                overflow: "hidden",
                transition: "border-color .15s, background .15s",
                minHeight: 180,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
              }}
              onMouseEnter={e => { if (!customImageDataUrl) e.currentTarget.style.borderColor = "#999"; }}
              onMouseLeave={e => { if (!customImageDataUrl) e.currentTarget.style.borderColor = "#D0D0CC"; }}
            >
              {customImageDataUrl ? (
                <>
                  <img
                    src={customImageDataUrl}
                    alt="cover"
                    style={{ width: "100%", height: 200, objectFit: "cover", display: "block" }}
                  />
                  <div style={{ padding: "10px 0 14px", fontSize: 12, color: "#1F8A5B", fontWeight: 600 }}>
                    ✓ {customImageName} — click to change
                  </div>
                </>
              ) : (
                <>
                  <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ opacity: 0.3 }}>
                    <rect x="3" y="7" width="30" height="22" rx="3" stroke="#111" strokeWidth="2"/>
                    <circle cx="13" cy="16" r="3" stroke="#111" strokeWidth="2"/>
                    <path d="M3 24l8-7 6 6 4-4 12 9" stroke="#111" strokeWidth="2" strokeLinejoin="round"/>
                  </svg>
                  <div style={{ fontSize: 15, fontWeight: 500, color: "#333" }}>Choose a photo</div>
                  <div style={{ fontSize: 12, color: "#999" }}>JPG, PNG, WEBP · resized to 640px</div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const dataUrl = await resizeImageFile(file);
                  setCustomImageDataUrl(dataUrl);
                  setCustomImageName(file.name);
                }}
              />
            </div>

            <FlowNav onBack={goBack} onNext={advanceStep} nextDisabled={false} nextLabel={customImageDataUrl ? "Continue" : "Skip"} />
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
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>Remind me on day</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="number" min={1} max={28}
                      value={reminderDay}
                      onChange={(e) => setReminderDay(Math.min(28, Math.max(1, parseInt(e.target.value) || 1)))}
                      style={{ width: 72, border: "1px solid var(--border)", borderRadius: 8, padding: "11px 14px", fontSize: 15, fontFamily: "var(--font)", outline: "none", textAlign: "center" }}
                    />
                    <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>of each month</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-secondary)", marginBottom: 6 }}>At what time</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[{ label: "Morning", sub: "9:00 AM", hour: 9 }, { label: "Noon", sub: "12:00 PM", hour: 12 }, { label: "Evening", sub: "6:00 PM", hour: 18 }].map(t => (
                      <button key={t.hour} onClick={() => setReminderHour(t.hour)}
                        style={{ flex: 1, padding: "10px 8px", border: "1px solid", borderColor: reminderHour === t.hour ? "var(--text-primary)" : "var(--border)", borderRadius: 10, cursor: "pointer", background: reminderHour === t.hour ? "var(--bg-muted)" : "var(--bg)", fontFamily: "var(--font)", textAlign: "center" }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{t.label}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{t.sub}</div>
                      </button>
                    ))}
                  </div>
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

            {txError && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#DC2626", display: "flex", alignItems: "center", gap: 8 }}>
                <span>⚠️</span><span>{txError}</span>
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={goBack} style={{ fontSize: 14, color: "var(--text-secondary)", cursor: "pointer", padding: "13px 0", border: "none", background: "none", fontFamily: "var(--font)" }}>Back</button>
              {walletConnected ? (
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  style={{ flex: 1, background: txError ? "#111" : "var(--green)", color: "#fff", fontSize: 15, fontWeight: 500, padding: "13px 20px", borderRadius: 8, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontFamily: "var(--font)", opacity: submitting ? 0.6 : 1 }}
                >
                  {submitting ? "Creating…" : txError ? "Retry →" : "Create jar"}
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

// ── V2 sidebar icon component ──────────────────────────────────────────────
function SidebarIcon({ name }: { name: string }) {
  const s = { width: 14, height: 14 };
  if (name === "jar")      return <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M4 2h6l-.4 1.2H4.4L4 2zM3 4h8v6.5A.5.5 0 0 1 10.5 11h-7A.5.5 0 0 1 3 10.5V4z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>;
  if (name === "home")     return <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M2 6l5-4 5 4v6H9V9H5v3H2V6z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>;
  if (name === "activity") return <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M1 7h2.5l1.5-4 2 8 1.5-4h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
  if (name === "people")   return <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="5.5" cy="5" r="2.2" stroke="currentColor" strokeWidth="1.2"/><path d="M1.5 12c.4-2 2-3 4-3s3.6 1 4 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/><circle cx="10.5" cy="4.5" r="1.6" stroke="currentColor" strokeWidth="1.2"/></svg>;
  if (name === "plus")     return <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>;
  if (name === "star")     return <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M7 1.5l1.4 3h3.1l-2.5 1.8 1 3L7 7.7 4 9.3l1-3L2.5 4.5h3.1L7 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>;
  if (name === "gear")     return <svg style={s} viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M7 1v2M7 11v2M13 7h-2M3 7H1" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>;
  if (name === "docs")     return <svg style={s} viewBox="0 0 14 14" fill="none"><path d="M3 2h6l2 2v8H3V2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M9 2v2h2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/><path d="M5 6h4M5 8.5h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>;
  return null;
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
  initialContribs,
}: {
  jar: JarType;
  apy: { usdc_kamino: number; sol_marinade: number };
  schedules: Schedule[];
  onBack: () => void;
  onMenuToggle: () => void;
  onAddFunds: (pubkey: string, name: string, currency: "usdc" | "sol") => void;
  onScheduleUpdate: (schedules: Schedule[]) => void;
  onJarBroken: (pubkey: string) => void;
  initialContribs?: JarContribution[];
}) {
  const { connection } = useConnection();
  const { wallet, publicKey } = useWallet();
  const [contribs, setContribs] = useState<JarContribution[]>(initialContribs ?? []);
  const [copied, setCopied] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
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
    if (!wallet?.adapter || jar.id.startsWith("Demo")) return;
    fetchContributionsForJar(jar.id).then(setContribs).catch(() => {});
    fetchCosigners(jar.id).then(setCosigners).catch(() => {});
    // Ensure slug is stored — fetch from backend if not in localStorage
    if (!getJarSlug(jar.id)) {
      fetch(`${BACKEND}/jar/meta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pubkey: jar.id, name: jar.name, emoji: jar.emoji, jarType: jar.jarType }),
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
    <div style={{ background: "#F4F4F1", flex: 1, display: "flex", flexDirection: "column" }}>
      {/* Mobile bar */}
      <div className="flex items-center justify-between border-b border-black/5 bg-[#F4F4F1] px-4 py-3 md:hidden">
        <button onClick={onMenuToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="#111" strokeWidth="1.6" strokeLinecap="round"/></svg>
        </button>
        <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.3px" }}>jarfi</div>
        <WalletButton compact />
      </div>
      {/* Back nav */}
      <div style={{ padding: "14px 24px 0" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 500, color: "#666", background: "none", border: "none", cursor: "pointer", fontFamily: "var(--font)" }}>
          ← Back
        </button>
      </div>

      <div style={{ padding: "20px 48px 40px", maxWidth: 1100, margin: "0 auto", width: "100%" }} className="jar-detail-wrap">
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
              <div style={{ fontSize: 60, fontWeight: 600, letterSpacing: "-2.5px", lineHeight: 1, color: "var(--text-primary)" }}>
                {fmt(jar.amount)}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 6 }}>
                Current balance
              </div>
              {jar.unlockDate > 0 && future > jar.amount && (
                <div style={{ fontSize: 13, color: "var(--green)", marginTop: 8, display: "flex", alignItems: "center", gap: 4 }}>
                  Est. at unlock: <strong style={{ marginLeft: 3 }}>{fmtK(future)}</strong>
                  <span title="Projected value based on current savings and yield at current APY" style={{ width: 14, height: 14, borderRadius: "50%", border: "1px solid var(--green)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 8, cursor: "help", opacity: 0.7 }}>?</span>
                </div>
              )}
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
                  <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px" }}>Kamino</div>
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
                  This includes your contributions and {isUsdc ? `Kamino ${apy.usdc_kamino}%` : `Kamino ${apy.usdc_kamino}%`} yield.
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
                { label: "Yield",    value: `${apy.usdc_kamino}% APY via Kamino` },
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
          {(() => {
            const now = Math.floor(Date.now() / 1000);
            const isEmpty = jar.amount === 0;
            const canBreak = !jar.locked ||
              jar.jarType === "SHARED" ||
              (jar.jarType === "DATE" && jar.unlockDate > 0 && now >= jar.unlockDate) ||
              (jar.jarType === "GOAL" && jar.goal > 0 && jar.amount >= jar.goal) ||
              (jar.jarType === "GOAL_BY_DATE" && ((jar.unlockDate > 0 && now >= jar.unlockDate) || (jar.goal > 0 && jar.amount >= jar.goal)));
            const lockHint = jar.jarType === "DATE"
              ? `Unlocks ${new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
              : jar.jarType === "GOAL"
              ? `Unlocks when goal of ${jar.goal > 0 ? `$${jar.goal.toLocaleString()}` : "?"} is reached`
              : jar.jarType === "GOAL_BY_DATE"
              ? `Unlocks at goal or on ${jar.unlockDate > 0 ? new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "date"}`
              : "";

            // Empty + locked → offer dashboard removal only (with two-step confirm)
            if (isEmpty && jar.locked && !canBreak) {
              return (
                <div style={{ marginTop: 16 }}>
                  {!confirmRemove ? (
                    <button onClick={() => setConfirmRemove(true)} style={{ width: "100%", padding: "10px 0", background: "none", border: "1px solid #E0E0DC", borderRadius: 9, color: "#888", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)" }}>
                      Remove from dashboard
                    </button>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 13, color: "#555", textAlign: "center" }}>Remove this jar from your dashboard?</div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button onClick={() => setConfirmRemove(false)} style={{ flex: 1, padding: "9px 0", background: "none", border: "1px solid #E0E0DC", borderRadius: 9, color: "#888", fontSize: 13, cursor: "pointer", fontFamily: "var(--font)" }}>Cancel</button>
                        <button onClick={() => { fetch(`${BACKEND}/jar/meta/${jar.id}`, { method: "DELETE" }).catch(() => {}); onJarBroken(jar.id); }} style={{ flex: 1, padding: "9px 0", background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 9, color: "#dc2626", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "var(--font)" }}>Remove</button>
                      </div>
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#bbb", textAlign: "center", marginTop: 6 }}>{lockHint} · No funds to withdraw</div>
                </div>
              );
            }

            return (
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={() => canBreak && setShowBreakModal(true)}
                  title={!canBreak ? lockHint : undefined}
                  style={{ width: "100%", padding: "10px 0", background: "none", border: `1px solid ${canBreak ? "#FCA5A5" : "#E0E0DC"}`, borderRadius: 9, color: canBreak ? "#DC2626" : "#AAAAAA", fontSize: 13, fontWeight: 600, cursor: canBreak ? "pointer" : "not-allowed", fontFamily: "var(--font)" }}
                >
                  🔨 {canBreak ? "Break jar & withdraw funds" : `Locked · ${lockHint}`}
                </button>
              </div>
            );
          })()}

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
                        href={`https://solscan.io/tx/${breakResult.txSignature}${process.env.NEXT_PUBLIC_SOLANA_NETWORK === 'mainnet' ? '' : '?cluster=devnet'}`}
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
    </div>
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
