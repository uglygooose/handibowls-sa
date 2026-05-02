"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { useId, useState, type Ref } from "react";

import { cn } from "@/lib/utils";

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
  ref?: Ref<HTMLInputElement>;
};

// Labeled text field with a mono-font uppercase label, optional hint, and
// inline error. Matches the Claude Design auth form styling.
//
// Phase 13 / 13-1 / Tier B / commit 4: refactored for full WCAG conformance
// — useId() for collision-free ids, aria-describedby wired to error + hint
// spans, aria-invalid on validation failure, focus-visible:ring-ink for
// the keyboard-focus indicator (was focus:ring-primary-500/12 — fails
// 3:1 contrast on bone). React 19 ref-as-prop replaces forwardRef.
export function Field({
  label,
  hint,
  error,
  fieldClassName,
  className,
  id,
  ref,
  ...props
}: FieldProps) {
  const reactId = useId();
  const fieldId = id ?? reactId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const invalid = Boolean(error);
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", fieldClassName)}>
      <label
        htmlFor={fieldId}
        className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-ink-muted"
      >
        {label}
      </label>
      <input
        id={fieldId}
        ref={ref}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          "h-13 w-full rounded-[10px] border border-border bg-surface px-3.5 text-[15px] text-ink transition-all",
          "placeholder:text-ink-subtle",
          "focus:border-primary-500 focus:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
          invalid && "border-danger-500 focus:border-danger-500",
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <span
          id={hintId}
          className="text-[11px] italic text-ink-subtle"
        >
          {hint}
        </span>
      )}
      {error && (
        <span
          id={errorId}
          role="alert"
          className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-danger-500"
        >
          <AlertCircle className="h-3 w-3" aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  );
}

type PasswordProps = Omit<FieldProps, "type">;

export function PasswordField({
  label = "Password",
  hint,
  error,
  fieldClassName,
  className,
  id,
  name = "password",
  ...props
}: PasswordProps) {
  const [visible, setVisible] = useState(false);
  const reactId = useId();
  const fieldId = id ?? reactId;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;
  const invalid = Boolean(error);
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className={cn("flex flex-col gap-1.5", fieldClassName)}>
      <label
        htmlFor={fieldId}
        className="font-mono text-[10px] font-bold tracking-[0.16em] uppercase text-ink-muted"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={fieldId}
          name={name}
          type={visible ? "text" : "password"}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-13 w-full rounded-[10px] border border-border bg-surface px-3.5 pr-11 text-[15px] text-ink transition-all",
            "placeholder:text-ink-subtle",
            "focus:border-primary-500 focus:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
            invalid && "border-danger-500 focus:border-danger-500",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-subtle hover:bg-surface-muted hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint && !error && (
        <span id={hintId} className="text-[11px] italic text-ink-subtle">
          {hint}
        </span>
      )}
      {error && (
        <span
          id={errorId}
          role="alert"
          className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-danger-500"
        >
          <AlertCircle className="h-3 w-3" aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  );
}
