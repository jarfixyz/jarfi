import { forwardRef, useId, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, className, id, ...rest }, ref) => {
    const generatedId = useId();
    const inputId = id ?? generatedId;
    const hintId = `${inputId}-hint`;
    const errorId = `${inputId}-error`;
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={inputId}
          className="text-sm font-semibold text-ink"
        >
          {label}
        </label>
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          className={cn(
            "h-12 rounded-2xl border-2 border-line bg-paper px-4 text-base text-ink",
            "placeholder:text-mute",
            "transition-colors duration-[var(--duration-base)]",
            "focus:border-coral focus:outline-none",
            error && "border-coral-deep focus:border-coral-deep",
            className,
          )}
          {...rest}
        />
        {hint && !error && (
          <p id={hintId} className="text-sm text-mute">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className="text-sm font-semibold text-coral-deep">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
