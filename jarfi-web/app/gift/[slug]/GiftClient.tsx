"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import TransakWidget from "@/components/TransakWidget";
import { contractToJarType, JAR_TYPE_LABELS, JAR_TYPE_ICONS, UNLOCK_RULE_LABEL } from "@/lib/jarTypes";
import type { JarType as JarTypeEnum } from "@/lib/jarTypes";

export type DisplayJar = {
  name: string;
  emoji: string;
  amountCents: number;
  goalCents: number;
  unlockLabel: string;
  contributors: number;
  jarType: JarTypeEnum;
  mode: number;
  unlockDate: number;
};

// Demo jars — real on-chain accounts on devnet
const SLUG_TO_PUBKEY: Record<string, string> = {
  anya:  "FeAzYeZuvo6eaPcsVp1Yguegcp2AhwwPWTfPV5Z4B9hC",
  japan: "ExvN6nxRbWpqQJrpG6shY9tbcWTtHKEaJDmFVebxFqu4",
  moto:  "28teBgT2U1y25ARUkgGfHjeyBHhnJXorVtLs6Qk93ppc",
};

const SLUG_META: Record<string, { name: string; emoji: string }> = {
  anya:  { name: "Anya's Future",   emoji: "🎁" },
  japan: { name: "Japan Trip",      emoji: "✈️" },
  moto:  { name: "Motorcycle Fund", emoji: "🏍️" },
};

const IS_SOLANA_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://jarfi.up.railway.app";

export default function GiftClient({ slug }: { slug: string }) {
  const knownPubkey = SLUG_TO_PUBKEY[slug];
  const isShortSlug = !knownPubkey && !IS_SOLANA_PUBKEY.test(slug);

  const [resolvedPubkey, setResolvedPubkey] = useState<string | null>(
    knownPubkey ?? (IS_SOLANA_PUBKEY.test(slug) ? slug : null)
  );
  const [jar, setJar] = useState<DisplayJar | null>(null);
  const [jarNotFound, setJarNotFound] = useState(false);
  const [amount, setAmount] = useState<number>(50);
  const [showTransak, setShowTransak] = useState(false);
  const [done, setDone] = useState(false);

  // Resolve short slug → pubkey via backend
  useEffect(() => {
    if (!isShortSlug) return;
    fetch(`${BACKEND_URL}/jar/by-slug/${slug}`)
      .then(r => r.json())
      .then(d => { if (d.ok && d.pubkey) setResolvedPubkey(d.pubkey); else setJarNotFound(true); })
      .catch(() => setJarNotFound(true));
  }, [slug, isShortSlug]);

  useEffect(() => {
    if (!resolvedPubkey) return;

    const timeout = setTimeout(() => setJarNotFound(true), 8000);

    fetch(`${BACKEND_URL}/jar/${resolvedPubkey}`)
      .then((r) => r.json())
      .then((data: {
        ok: boolean;
        jar?: {
          mode: number; unlockDate: number; goalAmount: number; balance: number;
          usdcBalance?: number | null; jarCurrency?: number | null; name?: string | null; emoji?: string | null;
        };
        contributions?: unknown[];
      }) => {
        clearTimeout(timeout);
        if (!data.ok || !data.jar) { setJarNotFound(true); return; }
        const j = data.jar;
        const date = j.unlockDate
          ? new Date(j.unlockDate * 1000).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
          : null;
        const isUsdc = j.jarCurrency === 0;
        const goalUsd = (j.goalAmount / (isUsdc ? 1_000_000 : 1_000_000_000)).toLocaleString();
        let unlockLabel = "";
        if (j.mode === 0) unlockLabel = date ? `Opens ${date}` : "Locked";
        else if (j.mode === 1) unlockLabel = `Opens when $${goalUsd} collected`;
        else unlockLabel = `Opens at $${goalUsd}${date ? ` or on ${date}` : ""}`;

        const slugMeta = SLUG_META[slug];
        const rawBalance = isUsdc ? (j.usdcBalance ?? 0) : (j.balance ?? 0);
        const divisor = isUsdc ? 1_000_000 : 1_000_000_000;
        const jarType = contractToJarType(j.mode, j.unlockDate);

        setJar({
          name:  j.name || slugMeta?.name || "Savings Jar",
          emoji: j.emoji || slugMeta?.emoji || "🫙",
          amountCents: Math.round(rawBalance / divisor),
          goalCents:   Math.round((j.goalAmount ?? 0) / divisor),
          unlockLabel,
          contributors: data.contributions?.length ?? 0,
          jarType,
          mode: j.mode,
          unlockDate: j.unlockDate,
        });
      })
      .catch(() => { clearTimeout(timeout); setJarNotFound(true); });
  }, [resolvedPubkey]);

  const vaultAddress = resolvedPubkey ?? "11111111111111111111111111111111";
  const pct   = jar ? Math.min(100, Math.round((jar.amountCents / Math.max(jar.goalCents, 1)) * 100)) : 0;
  const saved = jar ? (jar.amountCents / 100).toLocaleString(undefined, { minimumFractionDigits: 0 }) : "0";
  const goal  = jar ? (jar.goalCents  / 100).toLocaleString() : "0";
  const toGo  = jar ? Math.max(0, jar.goalCents - jar.amountCents) / 100 : 0;

  // ── Success screen ────────────────────────────────────────────────────────
  if (done && jar) {
    return (
      <Page>
        <Logo />
        <Card>
          <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: 20, alignItems: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 52 }}>🎉</div>
            <div style={{ fontSize: 40, fontWeight: 600, color: "var(--green)", letterSpacing: "-1.5px" }}>
              ${amount}
            </div>
            <div style={{ fontSize: 24, fontWeight: 500, letterSpacing: "-0.5px" }}>
              You just contributed to {jar.name.split("'")[0]}&apos;s future
            </div>
            <div style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.6, maxWidth: 300 }}>
              Every contribution brings the goal closer. Thank you for being part of this.
            </div>
            <div style={{ height: 1, background: "var(--border)", width: "100%" }} />
            <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              Want to start saving for your own goals?
            </div>
            <Link href="/dashboard" style={{
              display: "inline-flex", alignItems: "center",
              background: "var(--text-primary)", color: "#fff",
              fontSize: 15, fontWeight: 500, padding: "13px 28px",
              borderRadius: 8, textDecoration: "none",
            }}>
              Create your own jar
            </Link>
            <button onClick={() => setDone(false)} style={{ fontSize: 14, color: "var(--text-tertiary)", cursor: "pointer", border: "none", background: "none" }}>
              ← Back to jar
            </button>
          </div>
        </Card>
      </Page>
    );
  }

  // ── Not found ─────────────────────────────────────────────────────────────
  if (jarNotFound) {
    return (
      <Page>
        <Logo />
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
            <div style={{ fontSize: 40 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 500 }}>Jar not found</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
              This jar may not exist or the link may be incorrect.<br />
              <Link href="/" style={{ color: "var(--green)", textDecoration: "none", fontWeight: 500 }}>Go to jarfi.xyz</Link>
            </div>
          </div>
        </Card>
      </Page>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!jar) {
    return (
      <Page>
        <Logo />
        <Card>
          <div style={{ display: "flex", justifyContent: "center", padding: "64px 0" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid var(--border)", borderTopColor: "var(--green)", animation: "spin 0.8s linear infinite" }} />
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </Card>
      </Page>
    );
  }

  // ── Main contribution form ────────────────────────────────────────────────
  return (
    <Page>
      {showTransak && (
        <TransakWidget
          vaultAddress={vaultAddress}
          fiatAmount={amount}
          contributorMessage=""
          onSuccess={() => { setShowTransak(false); setDone(true); }}
          onClose={() => setShowTransak(false)}
        />
      )}

      <Logo />
      <Card>
        {/* Jar summary */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{jar.emoji}</div>
          <div style={{ fontSize: 22, fontWeight: 500, letterSpacing: "-0.5px", marginBottom: 8 }}>{jar.name}</div>
          {/* Jar type badge */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <span style={{ fontSize: 11, background: "#F0F0EC", color: "#555", padding: "3px 10px", borderRadius: 20, fontWeight: 500 }}>
              {JAR_TYPE_ICONS[jar.jarType]} {JAR_TYPE_LABELS[jar.jarType]}
            </span>
          </div>
          <div style={{ fontSize: 15, color: "var(--text-secondary)", marginBottom: 8 }}>
            <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>${saved}</strong> raised
            {jar.goalCents > 0 && <> · Goal: ${goal}</>}
          </div>
          {/* Unlock rule line */}
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 8 }}>
            {jar.jarType === "SHARED"
              ? "Creator can withdraw anytime"
              : UNLOCK_RULE_LABEL[jar.jarType === "GOAL" ? "GOAL_REACHED" : jar.jarType === "DATE" ? "DATE_REACHED" : "GOAL_OR_DATE"]}
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            Contribute in seconds — no crypto needed
          </div>
        </div>

        {/* Progress — only for GOAL or GOAL_BY_DATE with a goal set */}
        {(jar.jarType === "GOAL" || jar.jarType === "GOAL_BY_DATE") && jar.goalCents > 0 && (
          <div style={{ marginBottom: 28 }}>
            {/* Goal reached banner for GOAL_BY_DATE */}
            {jar.jarType === "GOAL_BY_DATE" && jar.amountCents >= jar.goalCents && (
              <div style={{ padding: "8px 12px", background: "#ECFDF5", borderRadius: 8, fontSize: 13, color: "#059669", marginBottom: 10, textAlign: "center" }}>
                🎉 Goal reached — still accepting contributions
                {jar.unlockDate > 0 && ` until ${new Date(jar.unlockDate * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-tertiary)", marginBottom: 8 }}>
              <span>{pct}% of goal</span>
              <span>${toGo.toLocaleString(undefined, { maximumFractionDigits: 0 })} to go</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${pct}%`, height: "100%", background: "var(--green)", borderRadius: 3 }} />
            </div>
          </div>
        )}

        <div style={{ height: 1, background: "var(--border)", margin: "24px 0" }} />

        {/* Amount selection */}
        <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 14 }}>Choose an amount</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {[25, 50, 100, 200].map((v) => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              style={{
                flex: 1, padding: "11px 16px", borderRadius: 8,
                border: `1px solid ${amount === v ? "var(--text-primary)" : "var(--border)"}`,
                background: amount === v ? "var(--text-primary)" : "var(--bg)",
                color: amount === v ? "#fff" : "var(--text-primary)",
                fontSize: 15, fontWeight: 500, cursor: "pointer",
                fontFamily: "var(--font)", minWidth: 60,
              }}
            >
              ${v}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{
            padding: "11px 14px", border: "1px solid var(--border)", borderRadius: 8,
            fontSize: 15, fontWeight: 600, background: "var(--bg-muted)",
            color: "var(--text-secondary)", minWidth: 44, textAlign: "center",
          }}>$</div>
          <input
            type="number"
            placeholder="Other amount"
            min={1}
            onChange={(e) => { const v = Number(e.target.value); if (v > 0) setAmount(v); }}
            style={{
              flex: 1, border: "1px solid var(--border)", borderRadius: 8,
              padding: "11px 14px", fontSize: 15, fontFamily: "var(--font)",
              color: "var(--text-primary)", background: "var(--bg)", outline: "none",
            }}
          />
        </div>

        {/* Pay button */}
        <button
          onClick={() => setShowTransak(true)}
          disabled={amount < 15}
          style={{
            width: "100%", padding: 16, fontSize: 16, fontWeight: 600,
            borderRadius: 8, background: "var(--text-primary)", color: "#fff",
            border: "none", cursor: amount < 15 ? "not-allowed" : "pointer",
            fontFamily: "var(--font)", marginTop: 20,
            opacity: amount < 15 ? 0.4 : 1,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          }}
        >
          <span>💳</span> Pay ${amount || 0} by card
        </button>
        <div style={{ fontSize: 12, color: "var(--text-tertiary)", textAlign: "center", marginTop: 12, lineHeight: 1.5 }}>
          Your card is processed securely · No wallet or crypto needed
        </div>
      </Card>
    </Page>
  );
}

// ── Layout helpers ────────────────────────────────────────────────────────────

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      background: "var(--bg-muted)", padding: 24,
      fontFamily: "var(--font)",
    }}>
      <div style={{ width: "100%", maxWidth: 440 }}>{children}</div>
      <style>{`:root { --bg-muted: #F7F8F7; }`}</style>
    </div>
  );
}

function Logo() {
  return (
    <Link href="/" style={{ display: "block", textAlign: "center", marginBottom: 40, fontSize: 17, fontWeight: 600, textDecoration: "none", color: "var(--text-primary)" }}>
      jar<span style={{ color: "var(--green)" }}>fi</span>
    </Link>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg)", border: "1px solid var(--border)",
      borderRadius: 20, padding: 36,
    }}>
      {children}
    </div>
  );
}
