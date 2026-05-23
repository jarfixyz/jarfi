"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useId, useState } from "react";
import { cn } from "@/lib/cn";

type BubMood =
  | "idle"
  | "happy"
  | "sleeping"
  | "shaking"
  | "celebrating"
  | "thinking";

type BubAsset = "sol" | "usdc";

interface BubProps {
  mood?: BubMood;
  fill?: number; // 0..100
  size?: number;
  asset?: BubAsset;
  className?: string;
  breathing?: boolean;
}

export function Bub({
  mood = "idle",
  fill = 0,
  size = 200,
  asset = "sol",
  className,
  breathing = true,
}: BubProps) {
  const id = useId();
  const gradId = `bub-liquid-${id}`;
  const shineId = `bub-shine-${id}`;
  const clipId = `bub-clip-${id}`;
  const glowId = `bub-glow-${id}`;
  const clamped = Math.max(0, Math.min(100, fill));
  const liquidY = 70 - (clamped / 100) * 50; // body interior: y 20..70
  const isShaking = mood === "shaking";
  const isSleeping = mood === "sleeping";
  const isHappy = mood === "happy" || mood === "celebrating";
  const isThinking = mood === "thinking";

  // Solana palette liquid
  const liquidStops =
    asset === "sol"
      ? ["#9945FF", "#14F195"] // purple → green
      : ["#14F195", "#A5D8FF"]; // green → sky

  const animate = breathing && !isShaking && !isSleeping;

  return (
    <div
      className={cn(
        "relative inline-block",
        isShaking && "animate-shake",
        animate && "animate-breathe",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 100 110"
        width={size}
        height={size}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradId} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor={liquidStops[0]}>
              <animate
                attributeName="stop-color"
                values={`${liquidStops[0]};${liquidStops[1]};${liquidStops[0]}`}
                dur="5s"
                repeatCount="indefinite"
              />
            </stop>
            <stop offset="100%" stopColor={liquidStops[1]}>
              <animate
                attributeName="stop-color"
                values={`${liquidStops[1]};${liquidStops[0]};${liquidStops[1]}`}
                dur="5s"
                repeatCount="indefinite"
              />
            </stop>
          </linearGradient>
          <linearGradient id={shineId} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={glowId} cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor="#9945FF" stopOpacity="0.25" />
            <stop offset="60%" stopColor="#14F195" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#14F195" stopOpacity="0" />
          </radialGradient>
          <clipPath id={clipId}>
            <rect x="18" y="20" width="64" height="70" rx="14" />
          </clipPath>
        </defs>

        {/* Soft ambient glow */}
        <circle cx="50" cy="55" r="48" fill={`url(#${glowId})`}>
          {animate && (
            <animate
              attributeName="r"
              values="46;52;46"
              dur="4.2s"
              repeatCount="indefinite"
            />
          )}
        </circle>

        {/* Lid */}
        <rect x="22" y="6" width="56" height="14" rx="6" fill="#0B2B1F" />
        <rect
          x="26"
          y="3"
          width="48"
          height="6"
          rx="3"
          fill="#0B2B1F"
          opacity="0.7"
        />

        {/* Body outline */}
        <rect
          x="16"
          y="18"
          width="68"
          height="74"
          rx="16"
          fill="#FFFFFF"
          stroke="#0B2B1F"
          strokeWidth="3"
        />

        {/* Liquid */}
        <g clipPath={`url(#${clipId})`}>
          <rect
            x="18"
            y={liquidY}
            width="64"
            height={90 - liquidY}
            fill={`url(#${gradId})`}
          >
            {clamped > 0 && (
              <animate
                attributeName="y"
                values={`${liquidY};${liquidY - 1.8};${liquidY}`}
                dur="3s"
                repeatCount="indefinite"
              />
            )}
          </rect>

          {/* Animated wave crest */}
          {clamped > 0 && (
            <path
              d={`M 18 ${liquidY} Q 34 ${liquidY - 2} 50 ${liquidY} T 82 ${liquidY} L 82 90 L 18 90 Z`}
              fill={`url(#${gradId})`}
              opacity="0.65"
            >
              <animate
                attributeName="d"
                values={`
                  M 18 ${liquidY} Q 34 ${liquidY - 2} 50 ${liquidY} T 82 ${liquidY} L 82 90 L 18 90 Z;
                  M 18 ${liquidY} Q 34 ${liquidY + 2} 50 ${liquidY} T 82 ${liquidY} L 82 90 L 18 90 Z;
                  M 18 ${liquidY} Q 34 ${liquidY - 2} 50 ${liquidY} T 82 ${liquidY} L 82 90 L 18 90 Z
                `}
                dur="3.5s"
                repeatCount="indefinite"
              />
            </path>
          )}

          {/* Wave highlight */}
          {clamped > 0 && (
            <ellipse
              cx="50"
              cy={liquidY + 1}
              rx="32"
              ry="3"
              fill="#FFFFFF"
              opacity="0.35"
            />
          )}

          {/* Floating bubbles */}
          {clamped > 10 && (
            <>
              <circle cx="32" cy="80" r="1.6" fill="#FFFFFF" opacity="0.7">
                <animate attributeName="cy" values="82;24;24" dur="4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.8;0" dur="4s" repeatCount="indefinite" />
              </circle>
              <circle cx="58" cy="85" r="1.2" fill="#FFFFFF" opacity="0.6">
                <animate attributeName="cy" values="85;28;28" dur="5.5s" begin="1s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.7;0" dur="5.5s" begin="1s" repeatCount="indefinite" />
              </circle>
              <circle cx="68" cy="78" r="1" fill="#FFFFFF" opacity="0.5">
                <animate attributeName="cy" values="78;26;26" dur="4.6s" begin="2.3s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0;0.6;0" dur="4.6s" begin="2.3s" repeatCount="indefinite" />
              </circle>
            </>
          )}
        </g>

        {/* Glass shine sweep */}
        <rect
          x="20"
          y="20"
          width="20"
          height="70"
          rx="10"
          fill={`url(#${shineId})`}
          opacity="0.5"
          clipPath={`url(#${clipId})`}
        />

        {/* Cheeks */}
        {!isSleeping && (
          <>
            <ellipse cx="34" cy="58" rx="5" ry="3" fill="#FF9FD3" opacity="0.85" />
            <ellipse cx="66" cy="58" rx="5" ry="3" fill="#FF9FD3" opacity="0.85" />
          </>
        )}

        {/* Eyes */}
        <BubEyes mood={mood} />

        {/* Mouth */}
        {isHappy && (
          <path
            d="M 42 60 Q 50 67 58 60"
            stroke="#0B2B1F"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {isThinking && (
          <line
            x1="44"
            y1="62"
            x2="56"
            y2="62"
            stroke="#0B2B1F"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        )}

        {/* Sleeping Z */}
        {isSleeping && (
          <text
            x="80"
            y="22"
            fontSize="14"
            fontWeight="700"
            fill="#6B8478"
            fontFamily="var(--font-sans)"
          >
            z
          </text>
        )}
      </svg>

      <AnimatePresence>
        {mood === "celebrating" && <Confetti />}
      </AnimatePresence>
    </div>
  );
}

function BubEyes({ mood }: { mood: BubMood }) {
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (mood === "sleeping" || mood === "happy" || mood === "celebrating") {
      return;
    }
    let cancelled = false;
    let closeId: ReturnType<typeof setTimeout> | undefined;
    let nextId: ReturnType<typeof setTimeout> | undefined;

    const scheduleNext = () => {
      const delay = 4000 + Math.random() * 2000;
      nextId = setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        closeId = setTimeout(() => {
          if (cancelled) return;
          setBlink(false);
          scheduleNext();
        }, 120);
      }, delay);
    };
    scheduleNext();

    return () => {
      cancelled = true;
      if (closeId) clearTimeout(closeId);
      if (nextId) clearTimeout(nextId);
    };
  }, [mood]);

  if (mood === "sleeping") {
    return (
      <>
        <path d="M 36 48 Q 40 52 44 48" stroke="#0B2B1F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M 56 48 Q 60 52 64 48" stroke="#0B2B1F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (mood === "happy" || mood === "celebrating") {
    return (
      <>
        <path d="M 36 50 Q 40 44 44 50" stroke="#0B2B1F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <path d="M 56 50 Q 60 44 64 50" stroke="#0B2B1F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </>
    );
  }
  if (mood === "thinking") {
    return (
      <>
        <ellipse cx="40" cy="48" rx="3" ry={blink ? 0.5 : 3.5} fill="#0B2B1F" />
        <path d="M 56 48 Q 60 50 64 48" stroke="#0B2B1F" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      </>
    );
  }
  return (
    <>
      <ellipse cx="40" cy="48" rx="3" ry={blink ? 0.5 : 3.5} fill="#0B2B1F" />
      <ellipse cx="60" cy="48" rx="3" ry={blink ? 0.5 : 3.5} fill="#0B2B1F" />
    </>
  );
}

function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => i);
  const colors = ["#9945FF", "#14F195", "#A5D8FF", "#FFD93D"];
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {pieces.map((i) => {
        const angle = (i / pieces.length) * Math.PI * 2;
        const dist = 70 + Math.random() * 30;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist - 20;
        return (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-2 w-2 rounded-sm"
            style={{ backgroundColor: colors[i % colors.length] }}
            initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
            animate={{ x: dx, y: dy, scale: 1, opacity: 0, rotate: 360 }}
            transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          />
        );
      })}
    </motion.div>
  );
}
