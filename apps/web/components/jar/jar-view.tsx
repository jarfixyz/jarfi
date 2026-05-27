"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PublicKey } from "@solana/web3.js";
import { useConnection } from "@solana/wallet-adapter-react";
import { JarfiClient } from "@jarfi/sdk";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { useSignatureShake } from "@/lib/design/use-shake";
import { Markdown } from "@/components/ui/markdown";
import { ContributeModal } from "@/components/contribute/contribute-modal";
import { TransakModal } from "@/components/contribute/transak-modal";
import { useContribute } from "@/components/contribute/use-contribute";
import { OwnerControls } from "./owner-controls";
import { RefundBanner } from "./refund-banner";
import { ShareBar } from "./share-bar";
import { PostCreateModal } from "./post-create-modal";
import { ReminderPopover } from "@/components/reminders/reminder-popover";
import { ProjectionChart } from "@/components/charts/projection-chart";
import { useKaminoApy, formatApy } from "@/lib/yield-sim";
import type { JarPayload } from "@/lib/jar-fetch";

function decimalsFor(asset: "sol" | "usdc"): number {
  return asset === "sol" ? 1_000_000_000 : 1_000_000;
}

function formatCountdown(unlockTimestamp: number): string {
  const ms = unlockTimestamp * 1000 - Date.now();
  if (ms <= 0) return "Unlocked";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}h ${pad(m)}m`;
  return `${pad(h)}h ${pad(m)}m`;
}

type PillTone = "active" | "locked" | "done" | "cancelled";

function statusMeta(
  status: JarPayload["status"],
  jarType: JarPayload["jarType"],
): { label: string; tone: PillTone } {
  if (status === "active" && jarType === "timeLocked")
    return { label: "Locked", tone: "locked" };
  if (status === "active") return { label: "Active", tone: "active" };
  if (status === "withdrawn") return { label: "Withdrawn", tone: "done" };
  if (status === "cancelled") return { label: "Cancelled", tone: "cancelled" };
  return { label: "Active", tone: "active" };
}

const TONE_STYLES: Record<
  PillTone,
  { fg: string; bg: string; dot: string | null }
> = {
  active: { fg: "#1F6B4E", bg: "#E3F1EA", dot: "#2E8B64" },
  locked: { fg: "#2F4A78", bg: "#E6ECF6", dot: "#4869A3" },
  done: { fg: "#3A3A3A", bg: "#E8E7E2", dot: null },
  cancelled: { fg: "#8A3A32", bg: "#F5E4E1", dot: null },
};

const QUICK_AMOUNTS_SOL = ["0.1", "0.5", "1", "5"];
const QUICK_AMOUNTS_USDC = ["1", "5", "20", "100"];

export function JarView({
  jar: initialJar,
  shortId,
}: {
  jar: JarPayload;
  shortId: string | null;
}) {
  const { shaking, trigger } = useSignatureShake();
  const [altOpen, setAltOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [postCreateOpen, setPostCreateOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("created") === "1") {
      setPostCreateOpen(true);
    }
  }, [searchParams]);

  const closePostCreate = () => {
    setPostCreateOpen(false);
    router.replace(pathname);
  };
  const [jar, setJar] = useState(initialJar);
  const { connection } = useConnection();

  const [amount, setAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [reminderOpen, setReminderOpen] = useState(false);
  const apy = useKaminoApy();
  const { submit, status, error } = useContribute(jar, shortId, trigger, () => {
    setAmount("");
  });

  useEffect(() => {
    setJar(initialJar);
  }, [initialJar]);

  useEffect(() => {
    if (!connection) return;
    let cancelled = false;
    const client = JarfiClient.readonly(connection);
    const jarPk = new PublicKey(jar.pda);

    const statusKey = (v: unknown): JarPayload["status"] => {
      const k = typeof v === "string" ? v : Object.keys(v ?? {})[0];
      return k === "withdrawn" || k === "cancelled" ? k : "active";
    };

    client
      .fetchJar(jarPk)
      .then((res) => {
        if (cancelled || !res) return;
        setJar((prev) => ({
          ...prev,
          totalContributed: res.account.totalContributed.toString(),
          totalContributors: res.account.totalContributors,
          status: statusKey(res.account.status),
        }));
      })
      .catch(() => undefined);

    const unsub = client.onJarChange(jarPk, (info) => {
      if (!info) return;
      setJar((prev) => ({
        ...prev,
        totalContributed: info.account.totalContributed.toString(),
        totalContributors: info.account.totalContributors,
        status: statusKey(info.account.status),
      }));
      trigger();
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, [connection, jar.pda, trigger]);

  const dec = decimalsFor(jar.asset);
  const amountNum = Number(jar.totalContributed) / dec;
  const goalNum = Number(jar.goalAmount) > 0 ? Number(jar.goalAmount) / dec : null;
  const typeLabel = jar.jarType === "flexible" ? "Flexible" : "Time-locked";
  const assetLabel = jar.asset.toUpperCase();
  const quick = jar.asset === "sol" ? QUICK_AMOUNTS_SOL : QUICK_AMOUNTS_USDC;
  const places = jar.asset === "sol" ? 3 : 2;
  const { label: statusLabel, tone: statusTone } = statusMeta(
    jar.status,
    jar.jarType,
  );

  const coverEmoji = jar.metadata.coverUrl?.startsWith("emoji:")
    ? jar.metadata.coverUrl.slice("emoji:".length)
    : null;
  const coverImage =
    jar.metadata.coverUrl && !coverEmoji ? jar.metadata.coverUrl : null;

  return (
    <section
      className="theme-editorial theme-editorial--jar"
      style={{
        fontFamily:
          "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
        color: "var(--h-ink)",
        padding: "36px 48px 64px",
      }}
    >
      <RefundBanner jar={jar} />

      {shortId && (
        <div className="mb-6">
          <ShareBar shortId={shortId} isActive={jar.status === "active"} title={jar.metadata.title} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        {/* LEFT: cover + title + goal card + description */}
        <motion.article
          layout
          className={cn("flex flex-col gap-5", shaking && "animate-shake")}
        >
          {/* Cover */}
          <div
            className="relative overflow-hidden rounded-[14px]"
            style={{
              height: 220,
              background: coverImage ? undefined : "var(--h-bg-2)",
              border: "0.5px solid var(--h-line)",
            }}
          >
            {coverImage ? (
              <Image
                src={coverImage}
                alt=""
                width={1200}
                height={675}
                sizes="(max-width: 1024px) 100vw, 660px"
                priority
                unoptimized
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div
                className="flex h-full w-full items-center justify-center"
                style={{ fontSize: 64, color: "var(--h-ink-2)" }}
              >
                {coverEmoji ?? jar.metadata.title.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="absolute left-3 top-3">
              <StatusPill tone={statusTone} label={statusLabel} />
            </div>
          </div>

          {/* Title & meta */}
          <div className="text-center">
            <h1
              style={{
                fontSize: "clamp(26px, 2.8vw, 34px)",
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "var(--h-ink)",
              }}
            >
              {jar.metadata.title}
            </h1>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
              <Chip>{typeLabel}</Chip>
              <Chip>{assetLabel}</Chip>
              {jar.jarType === "timeLocked" && jar.unlockTimestamp && (
                <Chip>Unlocks in {formatCountdown(jar.unlockTimestamp)}</Chip>
              )}
            </div>
          </div>

          {/* Compact Saved / Goal pill */}
          <div
            className="inline-flex items-center self-center rounded-[10px]"
            style={{
              background: "var(--h-card-warm)",
              border: "0.5px solid var(--h-line)",
              padding: "10px 14px",
              gap: 18,
            }}
          >
            <div>
              <div
                className="text-[11px]"
                style={{ color: "var(--h-ink-3)", letterSpacing: "0.01em" }}
              >
                Saved
              </div>
              <div
                className="tabular-nums"
                style={{
                  fontSize: 17,
                  fontWeight: 500,
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                  color: "var(--h-ink)",
                }}
              >
                {amountNum.toFixed(places)}{" "}
                <span style={{ color: "var(--h-ink-3)", fontSize: 12 }}>
                  {assetLabel}
                </span>
              </div>
            </div>
            {goalNum && (
              <>
                <div
                  style={{
                    width: 1,
                    alignSelf: "stretch",
                    background: "var(--h-line)",
                  }}
                />
                <div>
                  <div
                    className="text-[11px]"
                    style={{ color: "var(--h-ink-3)", letterSpacing: "0.01em" }}
                  >
                    Goal
                  </div>
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: 17,
                      fontWeight: 500,
                      lineHeight: 1.15,
                      letterSpacing: "-0.01em",
                      color: "var(--h-ink)",
                    }}
                  >
                    {goalNum.toFixed(places)}{" "}
                    <span style={{ color: "var(--h-ink-3)", fontSize: 12 }}>
                      {assetLabel}
                    </span>
                  </div>
                  {amountNum > 0 && (
                    <div
                      className="mt-1 text-[11px] tabular-nums"
                      style={{ color: "var(--h-ink-3)" }}
                    >
                      {Math.min(100, Math.round((amountNum / goalNum) * 100))}%
                      to goal
                    </div>
                  )}
                </div>
              </>
            )}
          </div>


          {/* Kamino yield pill */}
          <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12.5px]"
               style={{ background: "var(--accent-goal-bg)", color: "var(--h-ink)", border: "0.5px solid var(--accent-goal)", marginTop: 12 }}>
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping" style={{ background: "var(--accent-goal)" }} />
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "var(--accent-goal)" }} />
            </span>
            Earning {formatApy(apy)} APY via Kamino
          </div>

          {/* Projection chart — only for time-locked jars with a horizon */}
          {amountNum > 0 &&
            jar.jarType === "timeLocked" &&
            jar.unlockTimestamp && (
              <div className="mt-6">
                <ProjectionChart
                  principal={amountNum}
                  apy={(apy ?? 5.4) / 100}
                  years={Math.max(
                    1,
                    Math.ceil(
                      (jar.unlockTimestamp * 1000 - Date.now()) /
                        (365.25 * 86_400_000),
                    ),
                  )}
                  title="Projection until unlock"
                  subtitle={`Locks ${new Date(jar.unlockTimestamp * 1000).toLocaleDateString("en", { month: "short", year: "numeric" })}`}
                  unit={jar.asset === "usdc" ? "USD" : assetLabel}
                  height={220}
                />
              </div>
            )}

          {/* Description */}
          {jar.metadata.description && (
            <div
              className="leading-relaxed"
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: "var(--h-ink-2)",
              }}
            >
              <Markdown source={jar.metadata.description} />
            </div>
          )}
        </motion.article>

        {/* RIGHT: donate panel */}
        <aside>
          <div className="lg:sticky lg:top-6">
            <div
              className="rounded-[12px] p-6"
              style={{
                background: "var(--h-card)",
                border: "0.5px solid var(--h-line)",
                boxShadow:
                  "0 1px 2px rgba(20,21,26,0.02), 0 16px 40px -24px rgba(20,21,26,0.12)",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 500,
                  lineHeight: 1.2,
                  letterSpacing: "-0.015em",
                  color: "var(--h-ink)",
                }}
              >
                Top up
              </div>

              {jar.status === "active" ? (
                <div className="mt-4 flex flex-col gap-3">
                  <div
                    className="flex items-center rounded-[10px]"
                    style={{
                      border: "0.5px solid var(--h-line-2)",
                      background: "var(--h-bg)",
                    }}
                  >
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="any"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 bg-transparent px-4 outline-none tabular-nums"
                      style={{
                        fontSize: 28,
                        fontWeight: 500,
                        color: "var(--h-ink)",
                        letterSpacing: "-0.015em",
                        padding: "14px 16px",
                      }}
                    />
                    <span
                      className="pr-4"
                      style={{
                        color: "var(--h-ink-3)",
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      {assetLabel}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {quick.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setAmount(q)}
                        className="rounded-full transition-colors"
                        style={{
                          background: "var(--h-bg-2)",
                          color: "var(--h-ink)",
                          padding: "6px 12px",
                          fontSize: 12.5,
                          fontWeight: 500,
                        }}
                      >
                        {q} {assetLabel}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    placeholder="Your name (optional)"
                    value={donorName}
                    onChange={(e) => setDonorName(e.target.value.slice(0, 40))}
                    className="rounded-[10px] outline-none"
                    style={{
                      border: "0.5px solid var(--h-line-2)",
                      background: "var(--h-bg)",
                      color: "var(--h-ink)",
                      padding: "11px 14px",
                      fontSize: 13.5,
                    }}
                  />

                  {error && (
                    <p style={{ color: "#8A3A32", fontSize: 12.5 }}>{error}</p>
                  )}

                  <button
                    type="button"
                    onClick={() => submit(Number(amount), donorName)}
                    disabled={status === "running" || !amount}
                    className="rounded-[8px] transition-colors"
                    style={{
                      background: "var(--h-accent)",
                      color: "#E8E7E2",
                      padding: "13px 24px",
                      fontSize: 14.5,
                      fontWeight: 500,
                      opacity: status === "running" || !amount ? 0.55 : 1,
                      cursor:
                        status === "running" || !amount
                          ? "default"
                          : "pointer",
                    }}
                  >
                    {status === "running" ? "Sending…" : `Send ${assetLabel}`}
                  </button>

                  <button
                    type="button"
                    onClick={() => setCardOpen(true)}
                    className="rounded-[8px] transition-colors"
                    style={{
                      background: "var(--h-bg-2)",
                      color: "var(--h-ink)",
                      padding: "11px 20px",
                      fontSize: 13.5,
                      fontWeight: 500,
                      border: "0.5px solid var(--h-line-2)",
                    }}
                  >
                    Pay with card
                  </button>

                  <button
                    type="button"
                    onClick={() => setReminderOpen(true)}
                    aria-expanded={reminderOpen}
                    className="rounded-[8px] transition-colors"
                    style={{
                      background: "var(--h-bg-2)",
                      color: "var(--h-ink)",
                      padding: "11px 20px",
                      fontSize: 13.5,
                      fontWeight: 500,
                    }}
                  >
                    🔔 Set reminder
                  </button>

                  <button
                    type="button"
                    onClick={() => setAltOpen(true)}
                    className="text-center"
                    style={{
                      color: "var(--h-ink-3)",
                      fontSize: 12.5,
                      background: "transparent",
                      padding: 0,
                      textDecoration: "underline",
                      textUnderlineOffset: 3,
                    }}
                  >
                    Pay with QR or manual transfer
                  </button>
                </div>
              ) : (
                <div
                  className="mt-4 rounded-[8px] px-4 py-3 text-center"
                  style={{
                    background: "var(--h-bg-2)",
                    color: "var(--h-ink-2)",
                    fontSize: 13,
                  }}
                >
                  This jar is no longer accepting contributions.
                </div>
              )}
            </div>

            <div className="mt-4">
              <OwnerControls jar={jar} shortId={shortId} />
            </div>
          </div>
        </aside>
      </div>

      <ContributeModal
        open={altOpen}
        onOpenChange={setAltOpen}
        jar={jar}
        shortId={shortId}
        onContributed={trigger}
        defaultTab="qr"
      />

      <TransakModal
        open={cardOpen}
        onOpenChange={setCardOpen}
        jar={jar}
        shortId={shortId}
        onContributed={trigger}
      />

      <PostCreateModal
        open={postCreateOpen}
        onClose={closePostCreate}
        onPayCard={() => { setPostCreateOpen(false); setCardOpen(true); }}
        onPayWallet={() => { setPostCreateOpen(false); setAltOpen(true); }}
        onRemind={() => { setPostCreateOpen(false); setReminderOpen(true); }}
      />

      <ReminderPopover
        open={reminderOpen}
        onClose={() => setReminderOpen(false)}
        jarName={jar.metadata?.title ?? "your jar"}
        defaultDate={
          jar.jarType === "timeLocked" && jar.unlockTimestamp
            ? new Date(
                Math.max(
                  Date.now() + 86_400_000,
                  jar.unlockTimestamp * 1000 - 86_400_000,
                ),
              )
                .toISOString()
                .slice(0, 10)
            : undefined
        }
      />
    </section>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="rounded-full px-2.5 py-[3px] text-[11px]"
      style={{
        background: "var(--h-card-warm)",
        border: "0.5px solid var(--h-line)",
        color: "var(--h-ink-2)",
      }}
    >
      {children}
    </span>
  );
}

function StatusPill({ tone, label }: { tone: PillTone; label: string }) {
  const s = TONE_STYLES[tone];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] text-[10px] font-medium"
      style={{ color: s.fg, background: s.bg }}
    >
      {s.dot && (
        <span
          aria-hidden
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: s.dot }}
        />
      )}
      {label}
    </span>
  );
}
