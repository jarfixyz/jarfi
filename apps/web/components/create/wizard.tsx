"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { InlineCalendar } from "@/components/ui/inline-calendar";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { CoverGrid } from "@/components/create/cover-grid";
import { PreviewCard } from "@/components/create/preview-card";
import { SummaryRows } from "@/components/create/summary-rows";
import { useCreateJar } from "@/components/create/use-create-jar";
import type { ProcessedCover } from "@/lib/cover";

type UiJarType = "goal" | "timeLocked" | "group";

type Step = 1 | 2 | 3 | 4;

type ReminderFreq = "weekly" | "monthly" | "never";

interface NotifPrefs {
  email: boolean;
  telegram: boolean;
  push: boolean;
}

const KAMINO_APY = 0.054;

function projectMonthly(monthly: number, years: number): number {
  const r = KAMINO_APY / 12;
  const n = years * 12;
  if (r === 0) return monthly * n;
  return monthly * ((Math.pow(1 + r, n) - 1) / r);
}

const stepAnim = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
};

const STEP_LABELS: Record<Step, { title: string; sub: string }> = {
  1: {
    title: "What are you saving for?",
    sub: "Give your jar a name and a cover.",
  },
  2: {
    title: "How should it work?",
    sub: "Set the rules — type, asset, goal.",
  },
  3: {
    title: "Controls & reminders",
    sub: "Who gets notified, who can unlock, how often to nudge.",
  },
  4: {
    title: "Ready to create",
    sub: "Double-check everything looks right.",
  },
};

export function CreateWizard() {
  const [step, setStep] = useState<Step>(1);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>("🎂");
  const [uploadedPhoto, setUploadedPhoto] = useState<ProcessedCover | null>(null);
  const [jarType, setJarType] = useState<UiJarType>("goal");
  const asset = "usdc" as const;
  const [goalEnabled, setGoalEnabled] = useState(true);
  const [goalAmount, setGoalAmount] = useState("");
  const [unlockDate, setUnlockDate] = useState<Date | null>(null);
  const [monthlyContribution, setMonthlyContribution] = useState("");

  // Demo-only state — surfaces UI but doesn't reach the on-chain submit yet.
  const [notif, setNotif] = useState<NotifPrefs>({
    email: true,
    telegram: false,
    push: true,
  });
  const [signers, setSigners] = useState<string[]>(["you@example.com"]);
  const [threshold, setThreshold] = useState(1);
  const [reminderFreq, setReminderFreq] = useState<ReminderFreq>("monthly");

  const { submit, status } = useCreateJar();

  function handleSelectEmoji(emoji: string) {
    setSelectedEmoji(emoji);
    setUploadedPhoto(null);
  }

  function handleUploadPhoto(photo: ProcessedCover) {
    setUploadedPhoto(photo);
    setSelectedEmoji(null);
  }

  async function handleSubmit() {
    const onChainType: "flexible" | "timeLocked" =
      jarType === "timeLocked" ? "timeLocked" : "flexible";
    if (typeof window !== "undefined") {
      sessionStorage.setItem("jarfi:last-create:variant", jarType);
    }
    await submit({
      title,
      description,
      jarType: onChainType,
      asset: "usdc",
      goal: goalEnabled ? parseFloat(goalAmount) : 0,
      hasGoal: goalEnabled && !!goalAmount,
      unlockDate: onChainType === "timeLocked" ? unlockDate : null,
      cover: uploadedPhoto,
      emoji: uploadedPhoto ? null : selectedEmoji,
      autoStake: false,
    });
  }

  const onChainJarType: "flexible" | "timeLocked" =
    jarType === "timeLocked" ? "timeLocked" : "flexible";

  const canProceed1 = title.trim().length > 0;
  const canProceed2 = jarType !== "timeLocked" || unlockDate !== null;
  const canProceed3 = signers.length > 0 && threshold >= 1 && threshold <= signers.length;
  const isCreating = status === "running";
  const isDone = status === "done";

  const showPreview = step < 4;
  const labels = STEP_LABELS[step];
  const stepName =
    step === 1 ? "Details" : step === 2 ? "Rules" : step === 3 ? "Controls" : "Review";

  const showProjection =
    jarType !== "timeLocked" && !goalEnabled && Number(monthlyContribution) > 0;
  const projection5y = showProjection
    ? projectMonthly(Number(monthlyContribution), 5)
    : 0;

  return (
    <section
      className="theme-editorial px-10 pb-20 pt-10 max-md:px-6"
      style={{ color: "var(--h-ink)" }}
    >
      <div
        className={`mx-auto ${
          showPreview
            ? "grid max-w-[960px] gap-12 max-md:max-w-[560px] max-md:grid-cols-1"
            : "max-w-[620px]"
        }`}
        style={showPreview ? { gridTemplateColumns: "1fr 320px" } : undefined}
      >
        {/* Left: Form */}
        <div>
          {/* Header */}
          <div className="mb-6">
            <p
              className="mb-3 text-[12px] tracking-[0.02em]"
              style={{ color: "var(--h-ink-3)" }}
            >
              Step {step} of 4 · {stepName}
            </p>
            <h1
              style={{
                fontFamily:
                  "var(--font-grotesk), ui-sans-serif, system-ui, sans-serif",
                fontSize: "clamp(28px, 3.4vw, 38px)",
                fontWeight: 500,
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
                color: "var(--h-ink)",
              }}
            >
              {labels.title}
            </h1>
            <p
              className="mt-2 text-[15px]"
              style={{ color: "var(--h-ink-2)", lineHeight: 1.55 }}
            >
              {labels.sub}
            </p>
          </div>

          <StepNav step={step} setStep={setStep} />

          {/* Card wrapper */}
          <div
            className="mt-6 rounded-[18px] p-7 max-md:p-5"
            style={{
              background: "var(--h-card)",
              border: "0.5px solid var(--h-line)",
            }}
          >
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="step1" {...stepAnim}>
                  <FieldLabel htmlFor="jar-title">Title</FieldLabel>
                  <input
                    id="jar-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Eva's 18th Birthday Fund"
                    className="mb-5 w-full rounded-[8px] px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[color:var(--h-ink-2)]"
                    style={inputStyle}
                  />

                  <FieldLabel htmlFor="jar-desc">
                    Description{" "}
                    <span style={{ color: "var(--h-ink-3)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>
                      (optional)
                    </span>
                  </FieldLabel>
                  <textarea
                    id="jar-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Why does this jar exist?"
                    className="mb-6 w-full resize-y rounded-[8px] px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[color:var(--h-ink-2)]"
                    style={{ ...inputStyle, minHeight: 72 }}
                  />

                  <FieldLabel>Cover</FieldLabel>
                  <div className="mb-7">
                    <CoverGrid
                      selectedEmoji={selectedEmoji}
                      uploadedPhoto={uploadedPhoto}
                      onSelectEmoji={handleSelectEmoji}
                      onUploadPhoto={handleUploadPhoto}
                    />
                  </div>

                  <PrimaryButton
                    disabled={!canProceed1}
                    onClick={() => setStep(2)}
                    fullWidth
                  >
                    Continue
                  </PrimaryButton>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="step2" {...stepAnim}>
                  <FieldLabel>Type</FieldLabel>
                  <div className="mb-5 grid grid-cols-3 gap-2 max-sm:grid-cols-1">
                    <TypeCard name="Goal jar"    blurb="Open when you hit the goal"   accent="var(--accent-goal)"  selected={jarType==="goal"}       onSelect={() => setJarType("goal")} />
                    <TypeCard name="Time-locked" blurb="Unlocks on a future date"     accent="var(--accent-lock)"  selected={jarType==="timeLocked"} onSelect={() => setJarType("timeLocked")} />
                    <TypeCard name="Group jar"   blurb="Many friends, one shared pot" accent="var(--accent-group)" selected={jarType==="group"}      onSelect={() => setJarType("group")} />
                  </div>

                  <AnimatePresence>
                    {jarType === "timeLocked" && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-5 overflow-visible"
                      >
                        <FieldLabel>Unlock date</FieldLabel>
                        <DateField value={unlockDate} onChange={setUnlockDate} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <FieldLabel>Asset</FieldLabel>
                  <div className="mb-5 flex items-center gap-3 rounded-[10px] p-3" style={{ background: "var(--h-bg)", border: "0.5px solid var(--h-line-2)" }}>
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-medium" style={{ background: "var(--h-bg-2)", border: "0.5px solid var(--h-line-2)" }}>$</span>
                    <div className="flex-1">
                      <div className="text-[13.5px] font-medium">USDC</div>
                      <div className="text-[12px]" style={{ color: "var(--h-ink-3)" }}>Stable value · Earns ~5.4% APY via Kamino</div>
                    </div>
                  </div>

                  <FieldLabel>Goal</FieldLabel>
                  <div className="mb-7 flex items-center gap-3">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={goalAmount}
                        onChange={(e) => setGoalAmount(e.target.value)}
                        disabled={!goalEnabled}
                        placeholder="0.00"
                        className="w-full rounded-[8px] px-3.5 py-2.5 pr-[56px] text-[14px] outline-none transition-colors focus:border-[color:var(--h-ink-2)]"
                        style={{
                          ...inputStyle,
                          opacity: goalEnabled ? 1 : 0.5,
                        }}
                      />
                      <span
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium tracking-[0.02em]"
                        style={{ color: "var(--h-ink-3)" }}
                      >
                        {asset.toUpperCase()}
                      </span>
                    </div>
                    <ToggleSwitch
                      checked={goalEnabled}
                      onChange={setGoalEnabled}
                      label={goalEnabled ? "On" : "Off"}
                    />
                  </div>

                  <AnimatePresence>
                    {jarType !== "timeLocked" && !goalEnabled && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mb-7 overflow-hidden"
                      >
                        <FieldLabel htmlFor="monthly-amt">
                          Monthly top-up{" "}
                          <span
                            style={{
                              color: "var(--h-ink-3)",
                              fontWeight: 400,
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          >
                            (optional)
                          </span>
                        </FieldLabel>
                        <div className="relative">
                          <input
                            id="monthly-amt"
                            type="number"
                            min="0"
                            value={monthlyContribution}
                            onChange={(e) =>
                              setMonthlyContribution(e.target.value)
                            }
                            placeholder="50"
                            className="w-full rounded-[8px] px-3.5 py-2.5 pr-[56px] text-[14px] outline-none transition-colors focus:border-[color:var(--h-ink-2)]"
                            style={inputStyle}
                          />
                          <span
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[11px] font-medium tracking-[0.02em]"
                            style={{ color: "var(--h-ink-3)" }}
                          >
                            USDC / MO
                          </span>
                        </div>
                        <AnimatePresence>
                          {showProjection && (
                            <motion.div
                              initial={{ opacity: 0, y: -4 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -4 }}
                              className="mt-3 rounded-[10px] p-3.5"
                              style={{
                                background: "var(--h-bg)",
                                border: "0.5px solid var(--h-line)",
                              }}
                            >
                              <div
                                className="text-[11px] uppercase tracking-[0.08em]"
                                style={{ color: "var(--h-ink-3)" }}
                              >
                                In 5 years, at ~5.4% APY
                              </div>
                              <div
                                className="mt-1 tabular-nums"
                                style={{
                                  fontSize: 22,
                                  fontWeight: 500,
                                  letterSpacing: "-0.01em",
                                  color: "var(--h-ink)",
                                }}
                              >
                                ≈ $
                                {projection5y.toLocaleString("en", {
                                  maximumFractionDigits: 0,
                                })}
                              </div>
                              <div
                                className="mt-1 text-[12px]"
                                style={{ color: "var(--h-ink-3)" }}
                              >
                                Projection, not a promise. Yield floats with
                                the market.
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-center gap-3">
                    <BackButton onClick={() => setStep(1)} />
                    <div className="ml-auto">
                      <PrimaryButton
                        disabled={!canProceed2}
                        onClick={() => setStep(3)}
                      >
                        Continue
                      </PrimaryButton>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="step3" {...stepAnim}>
                  <ControlsStep
                    notif={notif}
                    setNotif={setNotif}
                    signers={signers}
                    setSigners={setSigners}
                    threshold={threshold}
                    setThreshold={setThreshold}
                    reminderFreq={reminderFreq}
                    setReminderFreq={setReminderFreq}
                  />

                  <div className="mt-7 flex items-center gap-3">
                    <BackButton onClick={() => setStep(2)} />
                    <div className="ml-auto">
                      <PrimaryButton
                        disabled={!canProceed3}
                        onClick={() => setStep(4)}
                      >
                        Continue
                      </PrimaryButton>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div key="step4" {...stepAnim}>
                  <SummaryRows
                    title={title}
                    description={description}
                    emoji={selectedEmoji}
                    hasPhoto={!!uploadedPhoto}
                    asset={asset}
                    jarType={onChainJarType}
                    goalAmount={goalAmount}
                    goalEnabled={goalEnabled}
                    unlockDate={unlockDate}
                  />

                  <div className="mt-7 flex items-center gap-3">
                    <BackButton onClick={() => setStep(3)} />
                    <div className="ml-auto">
                      <PrimaryButton
                        disabled={isCreating || isDone}
                        onClick={handleSubmit}
                        done={isDone}
                      >
                        {isDone
                          ? "Created"
                          : isCreating
                            ? "Creating…"
                            : "Create jar"}
                      </PrimaryButton>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Preview */}
        {showPreview && (
          <div className="max-md:hidden">
            <div className="sticky top-[88px]">
              <p
                className="mb-3 text-[11px] uppercase tracking-[0.08em]"
                style={{ color: "var(--h-ink-3)" }}
              >
                Live preview
              </p>
              <PreviewCard
                title={title}
                description={description}
                emoji={selectedEmoji}
                photo={uploadedPhoto}
                asset={asset}
                jarType={onChainJarType}
                goalAmount={goalAmount}
                goalEnabled={goalEnabled}
                unlockDate={unlockDate}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--h-card)",
  border: "0.5px solid var(--h-line-2)",
  color: "var(--h-ink)",
};

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-2 block text-[11px] font-medium uppercase tracking-[0.08em]"
      style={{ color: "var(--h-ink-3)" }}
    >
      {children}
    </label>
  );
}

function StepNav({
  step,
  setStep,
}: {
  step: Step;
  setStep: (s: Step) => void;
}) {
  const items: { n: Step; label: string }[] = [
    { n: 1, label: "Details" },
    { n: 2, label: "Rules" },
    { n: 3, label: "Controls" },
    { n: 4, label: "Review" },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => {
        const isActive = it.n === step;
        const isDone = it.n < step;
        const clickable = it.n < step;
        return (
          <div key={it.n} className="flex items-center gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              disabled={!clickable && !isActive}
              onClick={() => {
                if (clickable) setStep(it.n);
              }}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors"
              style={
                isActive
                  ? {
                      background: "var(--h-accent)",
                      color: "#F1F0EC",
                      border: "0.5px solid var(--h-accent)",
                    }
                  : isDone
                    ? {
                        color: "var(--h-ink)",
                        background: "var(--h-bg)",
                        border: "0.5px solid var(--h-line-2)",
                        cursor: "pointer",
                      }
                    : {
                        color: "var(--h-ink-3)",
                        background: "transparent",
                        border: "0.5px solid var(--h-line)",
                      }
              }
            >
              <span
                className="inline-flex h-[16px] w-[16px] items-center justify-center rounded-full text-[10px]"
                style={{
                  background: isActive
                    ? "rgba(255,255,255,0.18)"
                    : isDone
                      ? "var(--h-accent)"
                      : "transparent",
                  color: isActive || isDone ? "#F1F0EC" : "var(--h-ink-3)",
                  border: isActive || isDone ? "none" : "0.5px solid var(--h-line-2)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {isDone ? "✓" : it.n}
              </span>
              {it.label}
            </button>
            {i < items.length - 1 && (
              <span
                aria-hidden
                className="h-[0.5px] w-6"
                style={{ background: "var(--h-line-2)" }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PrimaryButton({
  onClick,
  disabled,
  children,
  fullWidth,
  done,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  fullWidth?: boolean;
  done?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-[8px] px-6 py-3 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        fullWidth ? "w-full" : ""
      }`}
      style={{
        background: done ? "var(--h-ink-2)" : "var(--h-accent)",
        color: "#F1F0EC",
        border: "0.5px solid var(--h-accent-deep)",
      }}
      onMouseEnter={(e) => {
        if (!disabled && !done)
          e.currentTarget.style.background = "var(--h-accent-deep)";
      }}
      onMouseLeave={(e) => {
        if (!disabled && !done)
          e.currentTarget.style.background = "var(--h-accent)";
      }}
    >
      {children}
    </button>
  );
}

function DateField({
  value,
  onChange,
}: {
  value: Date | null;
  onChange: (d: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const display = value
    ? value.toLocaleDateString("en", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Select a date";

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-[8px] px-3.5 py-2.5 text-left text-[14px] outline-none transition-colors"
        style={{
          background: "var(--h-card)",
          border: `0.5px solid ${open ? "var(--h-ink-2)" : "var(--h-line-2)"}`,
          color: value ? "var(--h-ink)" : "var(--h-ink-3)",
        }}
      >
        <span>{display}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--h-ink-3)" }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="absolute left-0 top-[calc(100%+6px)] z-50"
            style={{
              filter: "drop-shadow(0 12px 32px rgba(20,21,26,0.12))",
            }}
          >
            <InlineCalendar
              value={value}
              onChange={(d) => {
                onChange(d);
                setOpen(false);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TypeCard({ name, blurb, accent, selected, onSelect }: {
  name: string; blurb: string; accent: string;
  selected: boolean; onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="text-left rounded-[10px] p-3 transition"
      style={{
        background: selected ? `color-mix(in oklab, ${accent} 8%, var(--h-card))` : "var(--h-card)",
        border: `0.5px solid ${selected ? accent : "var(--h-line-2)"}`,
        boxShadow: selected ? `0 0 0 1px ${accent} inset` : "none",
      }}
    >
      <div className="text-[13.5px] font-medium" style={{ color: "var(--h-ink)" }}>{name}</div>
      <div className="text-[12px] mt-0.5" style={{ color: "var(--h-ink-3)" }}>{blurb}</div>
    </button>
  );
}

function ControlsStep({
  notif,
  setNotif,
  signers,
  setSigners,
  threshold,
  setThreshold,
  reminderFreq,
  setReminderFreq,
}: {
  notif: NotifPrefs;
  setNotif: (n: NotifPrefs) => void;
  signers: string[];
  setSigners: (s: string[]) => void;
  threshold: number;
  setThreshold: (n: number) => void;
  reminderFreq: ReminderFreq;
  setReminderFreq: (f: ReminderFreq) => void;
}) {
  const [draftSigner, setDraftSigner] = useState("");

  function addSigner() {
    const v = draftSigner.trim();
    if (!v || signers.includes(v)) return;
    setSigners([...signers, v]);
    setDraftSigner("");
  }
  function removeSigner(s: string) {
    const next = signers.filter((x) => x !== s);
    setSigners(next);
    if (threshold > next.length) setThreshold(Math.max(1, next.length));
  }

  const reminderOptions: { value: ReminderFreq; label: string }[] = [
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" },
    { value: "never", label: "Never" },
  ];

  return (
    <div>
      <FieldLabel>Notifications</FieldLabel>
      <div className="mb-6 grid gap-2">
        <NotifRow
          title="Email"
          desc="Contribution receipts and unlock alerts."
          checked={notif.email}
          onChange={(v) => setNotif({ ...notif, email: v })}
        />
        <NotifRow
          title="Telegram"
          desc="Bot pings you for each top-up."
          checked={notif.telegram}
          onChange={(v) => setNotif({ ...notif, telegram: v })}
        />
        <NotifRow
          title="Push"
          desc="Browser notifications when the jar moves."
          checked={notif.push}
          onChange={(v) => setNotif({ ...notif, push: v })}
        />
      </div>

      <FieldLabel>Who can unlock the jar (multisig)</FieldLabel>
      <p
        className="mb-3 text-[12px]"
        style={{ color: "var(--h-ink-3)", lineHeight: 1.5 }}
      >
        Add co-signers by email or wallet. The jar opens only when enough of
        them approve.
      </p>
      <div className="mb-3 flex flex-col gap-2">
        {signers.map((s, i) => (
          <div
            key={s}
            className="flex items-center justify-between rounded-[8px] px-3 py-2"
            style={{
              background: "var(--h-bg)",
              border: "0.5px solid var(--h-line-2)",
            }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-medium"
                style={{
                  background: "var(--h-bg-2)",
                  border: "0.5px solid var(--h-line-2)",
                  color: "var(--h-ink-2)",
                }}
              >
                {i + 1}
              </span>
              <span
                className="truncate text-[13px]"
                style={{ color: "var(--h-ink)" }}
              >
                {s}
              </span>
              {i === 0 && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em]"
                  style={{
                    background: "var(--h-bg-2)",
                    color: "var(--h-ink-3)",
                  }}
                >
                  You
                </span>
              )}
            </div>
            {signers.length > 1 && i !== 0 && (
              <button
                type="button"
                onClick={() => removeSigner(s)}
                className="text-[11px] font-medium"
                style={{ color: "var(--h-ink-3)" }}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="mb-5 flex gap-2">
        <input
          type="text"
          value={draftSigner}
          onChange={(e) => setDraftSigner(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addSigner();
            }
          }}
          placeholder="friend@example.com or wallet address"
          className="flex-1 rounded-[8px] px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[color:var(--h-ink-2)]"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={addSigner}
          disabled={!draftSigner.trim()}
          className="rounded-[8px] px-4 py-2.5 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: "var(--h-bg)",
            border: "0.5px solid var(--h-line-2)",
            color: "var(--h-ink)",
          }}
        >
          Add
        </button>
      </div>

      <div
        className="mb-7 flex items-center justify-between rounded-[8px] px-3.5 py-3"
        style={{
          background: "var(--h-card)",
          border: "0.5px solid var(--h-line-2)",
        }}
      >
        <div>
          <div className="text-[13.5px] font-medium" style={{ color: "var(--h-ink)" }}>
            Approvals required
          </div>
          <div className="text-[12px]" style={{ color: "var(--h-ink-3)" }}>
            How many co-signers must approve to release funds.
          </div>
        </div>
        <select
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          className="rounded-[8px] px-2.5 py-1.5 text-[13px]"
          style={{
            background: "var(--h-bg)",
            border: "0.5px solid var(--h-line-2)",
            color: "var(--h-ink)",
          }}
        >
          {Array.from({ length: signers.length }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} of {signers.length}
            </option>
          ))}
        </select>
      </div>

      <FieldLabel>Contributor reminders</FieldLabel>
      <p
        className="mb-3 text-[12px]"
        style={{ color: "var(--h-ink-3)", lineHeight: 1.5 }}
      >
        Nudge people who opened the link but haven't chipped in yet.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {reminderOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setReminderFreq(o.value)}
            className="rounded-[8px] py-2.5 text-[13px] font-medium transition-colors"
            style={
              reminderFreq === o.value
                ? {
                    background: "var(--h-accent)",
                    color: "#F1F0EC",
                    border: "0.5px solid var(--h-accent-deep)",
                  }
                : {
                    background: "var(--h-card)",
                    color: "var(--h-ink)",
                    border: "0.5px solid var(--h-line-2)",
                  }
            }
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function NotifRow({
  title,
  desc,
  checked,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between rounded-[10px] p-3"
      style={{
        background: "var(--h-bg)",
        border: "0.5px solid var(--h-line-2)",
      }}
    >
      <div>
        <div className="text-[13.5px] font-medium" style={{ color: "var(--h-ink)" }}>
          {title}
        </div>
        <div className="text-[12px]" style={{ color: "var(--h-ink-3)" }}>
          {desc}
        </div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} label={checked ? "On" : "Off"} />
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[8px] px-4 py-3 text-[13px] font-medium transition-colors"
      style={{
        color: "var(--h-ink-2)",
        background: "transparent",
        border: "0.5px solid var(--h-line-2)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--h-bg)";
        e.currentTarget.style.color = "var(--h-ink)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--h-ink-2)";
      }}
    >
      ← Back
    </button>
  );
}
