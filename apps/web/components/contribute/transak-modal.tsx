"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import type { JarPayload } from "@/lib/jar-fetch";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jar: JarPayload;
  shortId: string | null;
  onContributed: () => void;
};

type Phase = "form" | "opening" | "awaiting" | "funded" | "contributed" | "failed";

interface InitResponse {
  depositId: string;
  walletAddress: string;
  widgetUrl: string | null;
  widgetError?: string | null;
}

interface TransakInstanceLike {
  init: () => void;
  close: () => void;
  cleanup?: () => void;
}

export function TransakModal({
  open,
  onOpenChange,
  jar,
  shortId,
  onContributed,
}: Props) {
  const [amount, setAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState<string | null>(null);
  const [depositId, setDepositId] = useState<string | null>(null);
  const [awaitingMs, setAwaitingMs] = useState(0);
  const sdkRef = useRef<TransakInstanceLike | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Defensively remove any lingering Transak DOM (overlays/iframes left behind,
  // including the error-state "Oops" modal whose own X button doesn't always
  // fire TRANSAK_WIDGET_CLOSE).
  const purgeTransakDom = () => {
    try { sdkRef.current?.close(); } catch {}
    try { sdkRef.current?.cleanup?.(); } catch {}
    sdkRef.current = null;
    if (typeof document !== "undefined") {
      const selectors = [
        '[id^="transak"]',
        '[class*="transak"]',
        'iframe[src*="transak"]',
        'iframe[src*="global.transak"]',
        'div[style*="z-index"][style*="2147483"]',
      ];
      for (const sel of selectors) {
        try {
          document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
            const root =
              (el.closest('[id^="transak"]') as HTMLElement | null) ??
              (el.closest('[class*="transak"]') as HTMLElement | null) ??
              el;
            // Skip our own portal pill (id set below).
            if (root.id === "jarfi-transak-cancel") return;
            root.remove();
          });
        } catch {}
      }
      // Transak locks body scroll; restore it.
      document.body.style.removeProperty("overflow");
      document.documentElement.style.removeProperty("overflow");
    }
  };

  const forceClose = () => {
    purgeTransakDom();
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    onOpenChange(false);
  };

  const reset = () => {
    setAmount("");
    setDonorName("");
    setPhase("form");
    setError(null);
    setDepositId(null);
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (sdkRef.current) {
      try {
        sdkRef.current.close();
      } catch {
        // ignore
      }
      sdkRef.current = null;
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) reset();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (phase !== "awaiting") { setAwaitingMs(0); return; }
    const start = Date.now();
    const id = setInterval(() => setAwaitingMs(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [phase]);

  // Escape always bails out, even when Transak's overlay traps clicks.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") forceClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const startPolling = (id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/transak/status?id=${id}`);
        if (!res.ok) return;
        const j = (await res.json()) as {
          status: Phase;
          contributeSignature?: string;
          error?: string;
        };
        if (j.status === "funded") setPhase("funded");
        if (j.status === "contributed") {
          setPhase("contributed");
          if (pollRef.current) clearInterval(pollRef.current);
          onContributed();
          toast.success("Card payment landed in the jar.");
        }
        if (j.status === "failed") {
          setPhase("failed");
          setError(j.error ?? "Payment failed");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // ignore polling errors
      }
    }, 4000);
  };

  const start = async () => {
    setError(null);
    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError("Enter an amount");
      return;
    }
    setPhase("opening");
    try {
      const res = await fetch("/api/transak/init", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          shortId,
          jarPda: shortId ? undefined : jar.pda,
          asset: jar.asset,
          amountUi: amountNum,
          donorName: donorName.trim() || undefined,
        }),
      });
      const j = (await res.json()) as InitResponse | { error: string };
      if (!res.ok || "error" in j) {
        throw new Error("error" in j ? j.error : "init failed");
      }
      setDepositId(j.depositId);
      startPolling(j.depositId);

      if (!j.widgetUrl) {
        if (j.widgetError) throw new Error(j.widgetError);
        setPhase("awaiting");
        return;
      }

      const mod = await import("@transak/transak-sdk");
      const Transak = mod.Transak;
      const transak = new Transak({
        widgetUrl: j.widgetUrl,
        referrer: window.location.origin,
      }) as unknown as TransakInstanceLike;
      sdkRef.current = transak;
      transak.init();
      setPhase("awaiting");

      const onSuccess = () => setPhase("funded");
      const onClose = () => {
        // Transak fires CLOSE both when the user hits the X and after a
        // successful order. Always purge their overlay so it can't trap the
        // page; only collapse the wrapper if we're still on the form/awaiting
        // step so the user still sees the on-chain confirmation phases.
        purgeTransakDom();
        setPhase((p) => {
          if (p === "awaiting" || p === "opening") {
            setTimeout(() => onOpenChange(false), 0);
            return "form";
          }
          return p;
        });
      };
      const Events = mod.Transak.EVENTS;
      // Static event API on the class.
      type TransakStatic = typeof mod.Transak & {
        on: (
          type: keyof typeof Events,
          cb: (data: unknown) => void,
        ) => void;
      };
      const TStatic = mod.Transak as TransakStatic;
      TStatic.on("TRANSAK_ORDER_SUCCESSFUL", onSuccess);
      TStatic.on("TRANSAK_WIDGET_CLOSE", onClose);
    } catch (e) {
      setPhase("failed");
      setError(e instanceof Error ? e.message : "Could not start payment");
    }
  };

  if (!open) return null;

  const sdkActive = phase === "opening" || phase === "awaiting";
  const cancelPill =
    sdkActive && mounted
      ? createPortal(
          <button
            id="jarfi-transak-cancel"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              forceClose();
            }}
            aria-label="Cancel payment"
            style={{
              position: "fixed",
              top: 18,
              right: 18,
              // Above Transak's own overlay (which uses ~2147483600).
              zIndex: 2147483647,
              background: "rgba(20,21,26,0.92)",
              color: "#F1F0EC",
              border: "0.5px solid rgba(255,255,255,0.18)",
              borderRadius: 999,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
              backdropFilter: "blur(8px)",
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
            }}
          >
            ✕ Cancel payment
          </button>,
          document.body,
        )
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(20,21,26,0.45)" }}
      onClick={forceClose}
    >
      {cancelPill}
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-[14px]"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
          padding: 24,
          maxWidth: 420,
          width: "92%",
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 500,
            color: "var(--h-ink)",
            marginBottom: 4,
          }}
        >
          Pay with card
        </div>
        <div
          style={{ fontSize: 12.5, color: "var(--h-ink-3)", marginBottom: 18 }}
        >
          Powered by Transak. No crypto wallet required.
        </div>

        {phase === "form" && (
          <div className="flex flex-col gap-3">
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
                  fontSize: 24,
                  fontWeight: 500,
                  color: "var(--h-ink)",
                  padding: "12px 14px",
                }}
              />
              <span
                className="pr-4"
                style={{ color: "var(--h-ink-3)", fontSize: 13 }}
              >
                {jar.asset.toUpperCase()}
              </span>
            </div>
            <input
              type="text"
              placeholder="Your name (optional, anonymous if empty)"
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={forceClose}
                className="flex-1 rounded-[8px]"
                style={{
                  background: "var(--h-bg-2)",
                  color: "var(--h-ink-2)",
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={start}
                className="flex-1 rounded-[8px]"
                style={{
                  background: "var(--h-accent)",
                  color: "#E8E7E2",
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {phase !== "form" && (
          <div className="flex flex-col gap-3">
            <Step
              active={phase === "opening" || phase === "awaiting"}
              done={
                phase === "funded" ||
                phase === "contributed" ||
                phase === "failed"
              }
              label="Card payment"
            />
            <Step
              active={phase === "funded"}
              done={phase === "contributed"}
              label="Funds received on Solana"
            />
            <Step
              active={phase === "contributed"}
              done={phase === "contributed"}
              label="Contribution recorded in the jar"
            />
            {error && (
              <p style={{ color: "#8A3A32", fontSize: 12.5 }}>{error}</p>
            )}
            {depositId && phase === "awaiting" && (
              <p style={{ color: "var(--h-ink-3)", fontSize: 12 }}>
                Complete payment in the Transak window. This dialog will update
                automatically.
              </p>
            )}
            {phase === "funded" && (
              <p style={{ color: "var(--h-ink-3)", fontSize: 12 }}>
                Payment confirmed. Sending on-chain contribution… (~1 min)
              </p>
            )}
            {phase === "awaiting" && awaitingMs > 30_000 && (
              <button
                type="button"
                onClick={forceClose}
                className="self-start text-[12px] underline"
                style={{ color: "var(--h-ink-3)" }}
              >
                Having trouble? Force close
              </button>
            )}
            <button
              type="button"
              onClick={forceClose}
              className="self-end rounded-[8px]"
              style={{
                background: "var(--h-bg-2)",
                color: "var(--h-ink-2)",
                padding: "10px 16px",
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {phase === "contributed" ? "Done" : "Close"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({
  active,
  done,
  label,
}: {
  active: boolean;
  done: boolean;
  label: string;
}) {
  const color = done ? "#1F6B4E" : active ? "var(--h-ink)" : "var(--h-ink-3)";
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: done ? "#2E8B64" : active ? "var(--h-accent)" : "var(--h-line)",
        }}
      />
      <span style={{ fontSize: 13, color }}>{label}</span>
    </div>
  );
}
