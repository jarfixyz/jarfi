import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  [
    "inline-flex items-center justify-center gap-2 rounded-full",
    "font-sans font-semibold whitespace-nowrap",
    "transition-all duration-[var(--duration-base)] ease-[var(--ease-spring)]",
    "disabled:opacity-50 disabled:cursor-not-allowed",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral",
    "active:scale-[0.97]",
  ],
  {
    variants: {
      variant: {
        primary:
          "bg-coral text-white shadow-sm hover:bg-coral-deep hover:shadow-md",
        secondary:
          "bg-surface text-coral border-2 border-coral hover:bg-coral-soft",
        ghost: "text-ink hover:bg-coral-soft",
      },
      size: {
        sm: "h-10 px-4 text-sm",
        md: "h-11 px-5 text-base",
        lg: "h-14 px-7 text-lg",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
);

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant, size, className, ...rest }, ref) => (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      {...rest}
    />
  ),
);
Button.displayName = "Button";
