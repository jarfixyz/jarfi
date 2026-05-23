"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

function diff(target: Date, now: Date) {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  };
}

const pad = (n: number) => n.toString().padStart(2, "0");

export function CountdownTimer({
  target,
  className,
}: {
  target: Date;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const d = diff(target, now);

  if (!d) {
    return (
      <span
        role="timer"
        className={cn("font-semibold text-mute", className)}
      >
        unlocked
      </span>
    );
  }

  return (
    <span
      role="timer"
      className={cn("font-extrabold tabular-nums text-ink", className)}
    >
      {d.d}d {pad(d.h)}h {pad(d.m)}m {pad(d.s)}s
    </span>
  );
}
