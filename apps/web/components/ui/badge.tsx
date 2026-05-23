import type { HTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
  {
    variants: {
      tone: {
        neutral: "bg-cream text-mute border border-line",
        coral: "bg-coral-soft text-coral-deep",
        mint: "bg-mint-soft text-[#0F766E]",
        sun: "bg-sun-soft text-[#854D0E]",
        sky: "bg-sky-soft text-[#1E40AF]",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ tone, className, ...rest }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...rest} />;
}
