"use client";

import { AlertCircle, Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";

import { cn } from "@/lib/utils";

type FieldProps = React.ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
  fieldClassName?: string;
};

// Labeled text field with a mono-font uppercase label, optional hint, and
// inline error. Matches the Claude Design auth form styling.
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, fieldClassName, className, id, ...props },
  ref,
) {
  const reactId = `field-${props.name ?? props.type ?? "input"}`;
  const fieldId = id ?? reactId;
  const invalid = Boolean(error);

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
        className={cn(
          "h-13 w-full rounded-[10px] border border-border bg-surface px-3.5 text-[15px] text-ink transition-all",
          "placeholder:text-ink-subtle",
          "focus:border-primary-500 focus:bg-bone focus:outline-none focus:ring-[3px] focus:ring-primary-500/12",
          invalid &&
            "border-danger-500 focus:border-danger-500 focus:ring-danger-500/15",
          className,
        )}
        {...props}
      />
      {hint && !error && (
        <span className="text-[11px] italic text-ink-subtle">{hint}</span>
      )}
      {error && (
        <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-danger-500">
          <AlertCircle className="h-3 w-3" aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  );
});

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
  const fieldId = id ?? `field-${name}`;
  const invalid = Boolean(error);

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
          className={cn(
            "h-13 w-full rounded-[10px] border border-border bg-surface px-3.5 pr-11 text-[15px] text-ink transition-all",
            "placeholder:text-ink-subtle",
            "focus:border-primary-500 focus:bg-bone focus:outline-none focus:ring-[3px] focus:ring-primary-500/12",
            invalid &&
              "border-danger-500 focus:border-danger-500 focus:ring-danger-500/15",
            className,
          )}
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-ink-subtle hover:bg-surface-muted hover:text-ink"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {hint && !error && (
        <span className="text-[11px] italic text-ink-subtle">{hint}</span>
      )}
      {error && (
        <span className="mt-0.5 inline-flex items-center gap-1 text-[12px] font-medium text-danger-500">
          <AlertCircle className="h-3 w-3" aria-hidden="true" /> {error}
        </span>
      )}
    </div>
  );
}
