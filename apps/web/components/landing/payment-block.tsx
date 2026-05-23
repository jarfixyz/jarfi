// apps/web/components/landing/payment-block.tsx
"use client";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";

type Stage = "idle" | "auth" | "processing" | "done";

export function PaymentBlock() {
  const [stage, setStage] = useState<Stage>("idle");
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (stage === "idle" || stage === "done") return;
    const next: Record<Stage, { to: Stage; ms: number } | null> = {
      idle: null,
      auth: { to: "processing", ms: prefersReduced ? 200 : 900 },
      processing: { to: "done", ms: prefersReduced ? 200 : 1100 },
      done: null,
    };
    const step = next[stage];
    if (!step) return;
    const t = setTimeout(() => setStage(step.to), step.ms);
    return () => clearTimeout(t);
  }, [stage, prefersReduced]);

  useEffect(() => {
    if (stage !== "done") return;
    const t = setTimeout(() => setStage("idle"), 2200);
    return () => clearTimeout(t);
  }, [stage]);

  const start = () => {
    if (stage === "idle") setStage("auth");
  };

  return (
    <section className="pb-section" id="payment">
      <div className="pb-grid">
        <div className="pb-text">
          <h2>Grandma pays with her Visa. The jar gets USDC.</h2>
          <p>
            She never sees the word &ldquo;crypto.&rdquo; Just a tap, Face ID,
            and it&apos;s done. Funds land in seconds — the contributor shows
            up in the jar feed with their note attached.
          </p>
          <div className="pb-methods" role="list" aria-label="Ways to fund a jar">
            <div className="pb-method" role="listitem">
              <span className="pb-method-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M17.04 12.84c-.02-2.4 1.96-3.56 2.05-3.61-1.12-1.64-2.86-1.86-3.48-1.88-1.48-.15-2.9.87-3.65.87-.76 0-1.92-.85-3.15-.83-1.62.02-3.12.94-3.96 2.39-1.69 2.94-.43 7.27 1.22 9.65.8 1.17 1.76 2.47 3.03 2.42 1.22-.05 1.67-.78 3.15-.78 1.47 0 1.89.78 3.18.76 1.31-.02 2.14-1.19 2.94-2.36.93-1.36 1.31-2.68 1.34-2.75-.03-.01-2.56-.98-2.58-3.88ZM14.65 6.13c.67-.81 1.12-1.94 1-3.06-.97.04-2.13.64-2.82 1.45-.62.71-1.17 1.86-1.03 2.97 1.08.08 2.17-.55 2.85-1.36Z"/></svg>
              </span>
              <span className="pb-method-name">Apple Pay</span>
            </div>
            <div className="pb-method" role="listitem">
              <span className="pb-method-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.64-.06-1.25-.16-1.84H12v3.49h5.38c-.23 1.25-.94 2.3-2.01 3v2.5h3.25c1.9-1.75 3-4.33 3-7.15z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.43l-3.25-2.5c-.9.6-2.05.95-3.37.95-2.6 0-4.8-1.75-5.58-4.1H3.05v2.58A10 10 0 0 0 12 22z"/><path fill="#FBBC05" d="M6.42 13.92a6 6 0 0 1 0-3.83V7.51H3.05a10 10 0 0 0 0 8.98l3.37-2.57z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.78.5 3.81 1.5l2.86-2.85C16.96 3.05 14.7 2 12 2A10 10 0 0 0 3.05 7.51l3.37 2.58C7.2 7.72 9.4 5.97 12 5.97z"/></svg>
              </span>
              <span className="pb-method-name">Google Pay</span>
            </div>
            <div className="pb-method" role="listitem">
              <span className="pb-method-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="13" rx="2"/><path d="M2.5 10h19"/><path d="M6 15h3"/></svg>
              </span>
              <span className="pb-method-name">Visa · MC</span>
            </div>
            <div className="pb-method" role="listitem">
              <span className="pb-method-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M48 95C73.9574 95 95 73.9574 95 48C95 22.0426 73.9574 1 48 1C22.0426 1 1 22.0426 1 48C1 73.9574 22.0426 95 48 95Z" fill="#2775CA"/>
                  <path d="M56.4609 13.7778V19.8291C68.5341 23.4716 77.3759 34.6928 77.3759 47.9997C77.3759 61.3066 68.5341 72.5278 56.4609 76.1703V82.2216C71.8534 78.4616 83.2509 64.5672 83.2509 47.9997C83.2509 31.4322 71.8534 17.5378 56.4609 13.7778Z" fill="white"/>
                  <path d="M18.625 47.9997C18.625 34.6928 27.4669 23.4716 39.54 19.8291V13.7778C24.1475 17.5378 12.75 31.4322 12.75 47.9997C12.75 64.5672 24.1475 78.4616 39.54 82.2216V76.1703C27.4669 72.5572 18.625 61.3066 18.625 47.9997Z" fill="white"/>
                  <path d="M60.6319 54.5506C60.6319 42.5362 41.8025 47.4713 41.8025 40.8325C41.8025 38.4531 43.7119 36.9256 47.3544 36.9256C51.7019 36.9256 53.2 39.0406 53.67 41.89H59.6625C59.1279 36.5426 56.0588 33.1662 50.9382 32.1604V27.4375H45.0632V31.9918C39.4534 32.7062 35.9275 35.973 35.9275 40.8325C35.9275 52.9056 54.7863 48.3819 54.7863 54.9031C54.7863 57.3706 52.4069 59.0156 48.3825 59.0156C43.1244 59.0156 41.3913 56.695 40.745 53.4931H34.8994C35.2781 59.3502 38.8897 63.0159 45.0632 63.9307V68.5625H50.9382V63.9923C56.9633 63.2139 60.6319 59.7089 60.6319 54.5506Z" fill="white"/>
                </svg>
              </span>
              <span className="pb-method-name">USDC</span>
            </div>
            <div className="pb-method" role="listitem">
              <span className="pb-method-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14h1M14 20h3v1M20 17v4"/></svg>
              </span>
              <span className="pb-method-name">Solana Pay</span>
            </div>
            <div className="pb-method" role="listitem">
              <span className="pb-method-icon" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="3"/><path d="M11 18h2"/></svg>
              </span>
              <span className="pb-method-name">Wallet</span>
            </div>
          </div>
          <div className="pb-methods-foot">
            One link, six ways in. The jar always ends up holding USDC.
          </div>
        </div>

        <div className="ap-sheet" role="group" aria-label="Apple Pay">
          <div className="ap-head">
            <div className="ap-brand" aria-hidden>
              <svg width="22" height="26" viewBox="0 0 24 28" fill="currentColor">
                <path d="M17.04 14.84c-.02-2.78 2.27-4.12 2.38-4.18-1.3-1.9-3.32-2.16-4.04-2.18-1.72-.17-3.36 1.01-4.23 1.01-.88 0-2.22-.99-3.65-.96-1.88.03-3.62 1.09-4.59 2.77-1.96 3.4-.5 8.43 1.41 11.19.93 1.35 2.05 2.86 3.51 2.81 1.41-.06 1.94-.91 3.65-.91 1.71 0 2.19.91 3.68.88 1.52-.03 2.48-1.38 3.41-2.74 1.08-1.57 1.52-3.1 1.55-3.18-.04-.02-2.96-1.13-2.98-4.51ZM14.27 6.69c.78-.94 1.3-2.25 1.16-3.55-1.12.04-2.47.74-3.27 1.68-.72.83-1.36 2.16-1.19 3.44 1.25.1 2.52-.63 3.3-1.57Z"/>
              </svg>
              <span>Pay</span>
            </div>
            <button
              type="button"
              aria-label="Close"
              className="ap-close"
              onClick={(e) => e.preventDefault()}
            >
              ×
            </button>
          </div>

          <div className="ap-row ap-row-top">
            <span className="ap-row-k">Pay</span>
            <span className="ap-row-v">jarfi</span>
          </div>
          <div className="ap-row">
            <span className="ap-row-k">To</span>
            <span className="ap-row-v">Lena&apos;s motorcycle jar</span>
          </div>
          <div className="ap-row">
            <span className="ap-row-k">Card</span>
            <span className="ap-row-v ap-card-line">
              <span className="ap-visa" aria-label="Visa">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 324.68" aria-hidden>
                  <path fill="#1434cb" d="m651.19.5c-70.93,0-134.32,36.77-134.32,104.69,0,77.9,112.42,83.28,112.42,122.42,0,16.48-18.88,31.23-51.14,31.23-45.77,0-79.98-20.61-79.98-20.61l-14.64,68.55s39.41,17.41,91.73,17.41c77.55,0,138.58-38.57,138.58-107.66,0-82.32-112.89-87.54-112.89-123.86,0-12.91,15.5-27.05,47.66-27.05,36.29,0,65.89,14.99,65.89,14.99l14.33-66.2S696.61.5,651.18.5h0ZM2.22,5.5L.5,15.49s29.84,5.46,56.72,16.36c34.61,12.49,37.07,19.77,42.9,42.35l63.51,244.83h85.14L379.93,5.5h-84.94l-84.28,213.17-34.39-180.7c-3.15-20.68-19.13-32.48-38.68-32.48,0,0-135.41,0-135.41,0Zm411.87,0l-66.63,313.53h81L494.85,5.5h-80.76Zm451.76,0c-19.53,0-29.88,10.46-37.47,28.73l-118.67,284.8h84.94l16.43-47.47h103.48l9.99,47.47h74.95L934.12,5.5h-68.27Zm11.05,84.71l25.18,117.65h-67.45l42.28-117.65h0Z"/>
                </svg>
              </span>
              <span className="ap-dots">···· 4242</span>
            </span>
          </div>

          <div className="ap-total">
            <span className="ap-total-k">Total</span>
            <span className="ap-total-v">$50.00</span>
          </div>

          <button
            type="button"
            className="ap-pay"
            onClick={start}
            disabled={stage !== "idle"}
            aria-live="polite"
          >
            <AnimatePresence mode="wait" initial={false}>
              {stage === "idle" && (
                <motion.span key="idle" className="ap-pay-inner ap-pay-brand" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <ApplePayMark />
                </motion.span>
              )}
              {stage === "auth" && (
                <motion.span key="auth" className="ap-pay-inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <motion.span
                    className="ap-spinner"
                    aria-hidden
                  />
                  <span>Confirming with Apple Pay…</span>
                </motion.span>
              )}
              {stage === "processing" && (
                <motion.span key="proc" className="ap-pay-inner" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <span className="ap-spinner" aria-hidden />
                  <span>Processing payment…</span>
                </motion.span>
              )}
              {stage === "done" && (
                <motion.span
                  key="done"
                  className="ap-pay-inner ap-pay-done"
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <motion.svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M5 12.5l4 4 10-10"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                    />
                  </motion.svg>
                  <span>Done</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          <AnimatePresence>
            {stage === "done" && (
              <motion.div
                className="ap-receipt"
                initial={{ opacity: 0, y: 8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
              >
                <span className="ap-receipt-dot" />
                Anna added <strong>$50.00</strong> · &ldquo;happy birthday!&rdquo;
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function ApplePayMark() {
  return (
    <span className="ap-mark" aria-label="Apple Pay">
      <svg width="22" height="26" viewBox="0 0 24 28" fill="currentColor" aria-hidden>
        <path d="M17.04 14.84c-.02-2.78 2.27-4.12 2.38-4.18-1.3-1.9-3.32-2.16-4.04-2.18-1.72-.17-3.36 1.01-4.23 1.01-.88 0-2.22-.99-3.65-.96-1.88.03-3.62 1.09-4.59 2.77-1.96 3.4-.5 8.43 1.41 11.19.93 1.35 2.05 2.86 3.51 2.81 1.41-.06 1.94-.91 3.65-.91 1.71 0 2.19.91 3.68.88 1.52-.03 2.48-1.38 3.41-2.74 1.08-1.57 1.52-3.1 1.55-3.18-.04-.02-2.96-1.13-2.98-4.51ZM14.27 6.69c.78-.94 1.3-2.25 1.16-3.55-1.12.04-2.47.74-3.27 1.68-.72.83-1.36 2.16-1.19 3.44 1.25.1 2.52-.63 3.3-1.57Z"/>
      </svg>
      <span className="ap-mark-text">Pay</span>
    </span>
  );
}
