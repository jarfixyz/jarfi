"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface JarFinalizingProps {
  pda: string;
  /** Optional short id to redirect to once visible. */
  shortId?: string | null;
}

const POLL_INTERVAL_MS = 2500;
const MAX_ATTEMPTS = 30; // ~75s total

export function JarFinalizing({ pda, shortId }: JarFinalizingProps) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;

    async function tick() {
      if (cancelled) return;
      attempt += 1;
      setAttempts(attempt);
      try {
        const res = await fetch(
          `/api/jars/exists?pda=${encodeURIComponent(pda)}`,
          { cache: "no-store" },
        );
        if (!cancelled && res.ok) {
          const body = (await res.json()) as { exists?: boolean };
          if (body.exists) {
            if (shortId) {
              router.replace(`/j/${shortId}`);
            } else {
              router.replace(`/jar/${pda}`);
              router.refresh();
            }
            return;
          }
        }
      } catch {
        /* swallow and retry */
      }
      if (attempt >= MAX_ATTEMPTS) {
        if (!cancelled) setGaveUp(true);
        return;
      }
      window.setTimeout(tick, POLL_INTERVAL_MS);
    }

    const id = window.setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [pda, shortId, router]);

  return (
    <section
      className="theme-editorial flex min-h-[60vh] items-center justify-center px-6 py-16"
      style={{ color: "var(--h-ink)" }}
    >
      <div
        className="w-full max-w-[440px] rounded-[16px] p-7 text-center"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line)",
        }}
      >
        {!gaveUp ? (
          <>
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center">
              <Spinner />
            </div>
            <h1
              style={{
                fontFamily:
                  "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                color: "var(--h-ink)",
              }}
            >
              Finalizing your jar on Solana…
            </h1>
            <p
              className="mt-2 text-[13.5px]"
              style={{ color: "var(--h-ink-2)", lineHeight: 1.55 }}
            >
              The transaction confirmed. We&apos;re waiting for indexers to
              catch up — usually a few seconds.
            </p>
            <p
              className="mt-4 text-[11px] uppercase tracking-[0.08em]"
              style={{ color: "var(--h-ink-3)" }}
            >
              Attempt {attempts} / {MAX_ATTEMPTS}
            </p>
          </>
        ) : (
          <>
            <h1
              style={{
                fontFamily:
                  "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                color: "var(--h-ink)",
              }}
            >
              Still syncing
            </h1>
            <p
              className="mt-2 text-[13.5px]"
              style={{ color: "var(--h-ink-2)", lineHeight: 1.55 }}
            >
              Your jar was created on-chain but our indexer hasn&apos;t picked
              it up yet. Try refreshing in a minute, or open your dashboard.
            </p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-[8px] px-4 py-2.5 text-[13px] font-medium"
                style={{
                  background: "var(--h-accent)",
                  color: "#F1F0EC",
                  border: "0.5px solid var(--h-accent-deep)",
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-[8px] px-4 py-2.5 text-[13px] font-medium"
                style={{
                  background: "var(--h-bg)",
                  color: "var(--h-ink)",
                  border: "0.5px solid var(--h-line-2)",
                }}
              >
                Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Spinner() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      style={{ animation: "jarfi-spin 0.9s linear infinite" }}
    >
      <style>{`@keyframes jarfi-spin{to{transform:rotate(360deg)}}`}</style>
      <circle
        cx="16"
        cy="16"
        r="12"
        stroke="var(--h-line-2)"
        strokeWidth="2.5"
      />
      <path
        d="M28 16a12 12 0 0 0-12-12"
        stroke="var(--h-accent)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
