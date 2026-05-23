"use client";
import { motion } from "framer-motion";

type JarType = {
  id: "goal" | "lock" | "group" | "recur";
  label: string;
  name: string;
  blurb: string;
  stat: string;
  meta: string;
  accent: string;
  accentBg: string;
  icon: React.ReactNode;
};

const TYPES: JarType[] = [
  {
    id: "goal",
    label: "Goal jar",
    name: "The motorcycle",
    blurb: "Set a number. Top-ups roll in and the jar opens the day you hit it.",
    stat: "$3,100",
    meta: "62% · 3 mo to go",
    accent: "var(--accent-goal)",
    accentBg: "var(--accent-goal-bg)",
    icon: <GoalIcon />,
  },
  {
    id: "lock",
    label: "Time-locked",
    name: "For the baby",
    blurb: "Untouchable until they turn 18. Grandparents add a bit each year.",
    stat: "$21,400",
    meta: "projected · 18y",
    accent: "var(--accent-lock)",
    accentBg: "var(--accent-lock-bg)",
    icon: <LockIcon />,
  },
  {
    id: "group",
    label: "Group jar",
    name: "The group trip",
    blurb: "One link, one card each. Everyone pitches in — no Venmo chasing.",
    stat: "$780",
    meta: "78% · 4 people",
    accent: "var(--accent-group)",
    accentBg: "var(--accent-group-bg)",
    icon: <GroupIcon />,
  },
  {
    id: "recur",
    label: "Recurring",
    name: "Monthly stash",
    blurb: "A nudge every month. Auto-saving on rails — set it and forget it.",
    stat: "$200/mo",
    meta: "auto · 14 months in",
    accent: "var(--accent-recur)",
    accentBg: "var(--accent-recur-bg)",
    icon: <RecurIcon />,
  },
];

export function JarTypesGrid() {
  return (
    <section className="jt-section" id="cases">
      <div className="jt-head">
        <h2>One jar. Any goal.</h2>
        <p>
          Four shapes for how you save. A bike, a trip, a nest egg for your
          kid — if it&apos;s worth saving for, it&apos;s worth a jar.
        </p>
      </div>
      <div className="jt-grid">
        {TYPES.map((t) => (
          <motion.div
            key={t.id}
            whileHover={{ y: -4 }}
            className="jt-card"
            style={{ "--card-accent": t.accent, "--card-accent-bg": t.accentBg } as React.CSSProperties}
          >
            <div className="jt-icon" aria-hidden>{t.icon}</div>
            <div className="jt-label">{t.label}</div>
            <div className="jt-name">{t.name}</div>
            <div className="jt-blurb">{t.blurb}</div>
            <div className="jt-foot">
              <span className="jt-stat">{t.stat}</span>
              <span className="jt-meta">{t.meta}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function GoalIcon()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></svg>; }
function LockIcon()  { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>; }
function GroupIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="9" r="3.5"/><circle cx="17" cy="11" r="2.5"/><path d="M3 19c.8-3 3.2-5 6-5s5.2 2 6 5"/><path d="M14 17.5c.6-1.6 1.9-2.5 3-2.5s2.4.9 3 2.5"/></svg>; }
function RecurIcon() { return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14.9-3"/><path d="M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14.9 3"/><path d="M20 19v-4h-4"/></svg>; }
