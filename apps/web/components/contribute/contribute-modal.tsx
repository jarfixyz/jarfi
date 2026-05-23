"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { JarPayload } from "@/lib/jar-fetch";
import { useContribute } from "./use-contribute";
import { QrTab } from "./qr-tab";
import { RawTab } from "./raw-tab";

type Tab = "wallet" | "qr" | "raw";

const QUICK_AMOUNTS_SOL = ["0.1", "0.5", "1", "5"];
const QUICK_AMOUNTS_USDC = ["1", "5", "20", "100"];

const INK = "#14151A";
const INK_2 = "#4A4D57";
const INK_3 = "#8A8D95";
const BG = "#FAFAF7";
const BG_2 = "#F1F0EC";
const LINE_2 = "rgba(20,21,26,0.14)";
const ACCENT = "#2B3038";
const ACCENT_SOFT = "#E8E7E2";

export function ContributeModal({
  open,
  onOpenChange,
  jar,
  shortId,
  onContributed,
  defaultTab = "wallet",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jar: JarPayload;
  shortId: string | null;
  onContributed: () => void;
  defaultTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(defaultTab);
  const [amount, setAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const { submit, status, error } = useContribute(jar, shortId, onContributed, () => {
    setAmount("");
    setCelebrating(true);
  });

  useEffect(() => {
    if (!open) setTab(defaultTab);
  }, [open, defaultTab]);

  useEffect(() => {
    if (!celebrating) return;
    const id = setTimeout(() => {
      setCelebrating(false);
      onOpenChange(false);
    }, 1500);
    return () => clearTimeout(id);
  }, [celebrating, onOpenChange]);

  const assetLabel = jar.asset === "sol" ? "SOL" : "USDC";
  const quick = jar.asset === "sol" ? QUICK_AMOUNTS_SOL : QUICK_AMOUNTS_USDC;

  const wrapperStyle: React.CSSProperties = {
    fontFamily: "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
    color: INK,
  };

  const tabStyles = (isActive: boolean): React.CSSProperties =>
    isActive
      ? {
          background: ACCENT,
          color: ACCENT_SOFT,
        }
      : {
          background: "transparent",
          color: INK_3,
        };

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Drop into jar">
      <div style={wrapperStyle}>
        {celebrating ? (
          <div className="flex flex-col items-center py-10">
            <div
              style={{
                fontSize: 32,
                fontWeight: 500,
                letterSpacing: "-0.015em",
                color: INK,
              }}
            >
              Thank you
            </div>
            <p style={{ color: INK_2, fontSize: 14, marginTop: 8 }}>
              Your contribution landed.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-5 flex gap-1">
              {(["wallet", "qr", "raw"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  className="rounded-full transition-colors"
                  style={{
                    padding: "7px 14px",
                    fontSize: 12.5,
                    fontWeight: 500,
                    ...tabStyles(tab === t),
                  }}
                >
                  {t === "wallet" ? "Wallet" : t === "qr" ? "QR" : "Manual"}
                </button>
              ))}
            </div>

            {tab === "wallet" && (
              <div className="flex flex-col gap-3">
                <label
                  style={{ fontSize: 12.5, color: INK_2, fontWeight: 500 }}
                >
                  How much?
                </label>
                <div
                  className="flex items-center rounded-[10px]"
                  style={{
                    border: `0.5px solid ${LINE_2}`,
                    background: BG,
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
                    className="flex-1 bg-transparent outline-none tabular-nums"
                    style={{
                      fontSize: 28,
                      fontWeight: 500,
                      color: INK,
                      letterSpacing: "-0.015em",
                      padding: "14px 16px",
                      minWidth: 0,
                    }}
                  />
                  <span
                    className="pr-4"
                    style={{ color: INK_3, fontSize: 13, fontWeight: 500 }}
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
                        background: BG_2,
                        color: INK,
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
                    border: `0.5px solid ${LINE_2}`,
                    background: BG,
                    color: INK,
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
                    background: ACCENT,
                    color: ACCENT_SOFT,
                    padding: "13px 24px",
                    fontSize: 14.5,
                    fontWeight: 500,
                    opacity: status === "running" || !amount ? 0.55 : 1,
                    cursor:
                      status === "running" || !amount ? "default" : "pointer",
                    marginTop: 4,
                  }}
                >
                  {status === "running" ? "Sending…" : `Send ${assetLabel}`}
                </button>
              </div>
            )}

            {tab === "qr" && (
              <QrTab jar={jar} shortId={shortId} onContributed={onContributed} />
            )}

            {tab === "raw" && <RawTab jar={jar} />}
          </>
        )}
      </div>

    </Modal>
  );
}
