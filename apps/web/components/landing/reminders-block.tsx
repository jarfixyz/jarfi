// apps/web/components/landing/reminders-block.tsx
"use client";
import { motion, useReducedMotion } from "framer-motion";

type Channel = "browser" | "email" | "telegram";

const EVENTS: {
  id: string;
  day: string;
  time: string;
  channel: Channel;
  title: string;
  body: string;
  soon?: boolean;
}[] = [
  {
    id: "e1",
    day: "Mon",
    time: "09:00",
    channel: "browser",
    title: "Time to top up — Lena’s motorcycle jar",
    body: "Weekly $50 · you’re 62% there",
  },
  {
    id: "e2",
    day: "Wed",
    time: "07:30",
    channel: "email",
    title: "Honeymoon jar — weekly digest",
    body: "3 contributors · +$215 this week",
  },
  {
    id: "e3",
    day: "Fri",
    time: "20:00",
    channel: "telegram",
    title: "@jarfi_bot · For the baby",
    body: "Nudge Grandma to add this month’s $25?",
    soon: true,
  },
  {
    id: "e4",
    day: "Sat",
    time: "21:14",
    channel: "browser",
    title: "Anna added $50.00",
    body: "“happy birthday!” → Honeymoon jar",
  },
];

const CHANNELS: Record<Channel, { label: string; icon: React.ReactNode }> = {
  browser: {
    label: "Browser",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
      </svg>
    ),
  },
  email: {
    label: "Email",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
  },
  telegram: {
    label: "Telegram",
    icon: (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M21.9 4.3 18.6 20c-.2 1-.9 1.3-1.8.8l-5-3.7-2.4 2.3c-.3.3-.5.5-1 .5l.4-5.1 9.3-8.4c.4-.4-.1-.6-.6-.2L6 12.4l-5-1.6c-1.1-.3-1.1-1 .2-1.5L20.3 2.9c.9-.3 1.7.2 1.4 1.4Z" />
      </svg>
    ),
  },
};

export function RemindersBlock() {
  const prefersReduced = useReducedMotion();
  return (
    <section className="rb-section">
      <div className="rb-grid">
        <div className="rb-timeline" role="list" aria-label="Example reminders">
          <div className="rb-timeline-head">
            <span className="rb-timeline-title">This week</span>
            <span className="rb-timeline-meta">4 reminders</span>
          </div>
          <div className="rb-timeline-track">
            {EVENTS.map((e, i) => (
              <motion.div
                key={e.id}
                className={`rb-event${e.soon ? " rb-event-soon" : ""}`}
                role="listitem"
                initial={prefersReduced ? { opacity: 1 } : { opacity: 0, x: 8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ delay: 0.07 * i, duration: 0.35, ease: "easeOut" }}
              >
                <div className="rb-event-when">
                  <span className="rb-event-day">{e.day}</span>
                  <span className="rb-event-time">{e.time}</span>
                </div>
                <div className="rb-event-node" aria-hidden>
                  <span className={`rb-event-dot rb-event-dot-${e.channel}`} />
                </div>
                <div className="rb-event-body">
                  <div className="rb-event-meta">
                    <span className={`rb-channel rb-channel-${e.channel}`}>
                      {CHANNELS[e.channel].icon}
                      {CHANNELS[e.channel].label}
                    </span>
                    {e.soon && <span className="rb-event-pill">Soon</span>}
                  </div>
                  <div className="rb-event-title">{e.title}</div>
                  <div className="rb-event-text">{e.body}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="rb-text">
          <h2>A gentle nudge, not another forgotten goal.</h2>
          <p>
            Pick a cadence. Jarfi pings you when it&apos;s time to top up — and
            the contributors when something lands in their jar.
          </p>
          <p className="rb-soon">
            Browser today · Email, Telegram &amp; native mobile — soon.
          </p>
        </div>
      </div>
    </section>
  );
}
