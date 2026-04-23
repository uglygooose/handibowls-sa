import { forwardRef } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = Omit<React.ComponentProps<"input">, "type" | "children"> & {
  children: ReactNode;
  error?: boolean;
};

// HandiBowls native checkbox — styled with a 2px black border box that
// fills primary-500 when checked. Used on the remember-me and terms rows.
export const Checkbox = forwardRef<HTMLInputElement, Props>(function Checkbox(
  { children, error, className, ...props },
  ref,
) {
  return (
    <label
      className={cn(
        "relative flex cursor-pointer items-start gap-2.5 text-sm text-ink-muted",
        className,
      )}
    >
      <input ref={ref} type="checkbox" className="peer sr-only" {...props} />
      <span
        className={cn(
          "relative mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border-2 border-ink bg-bone transition-colors",
          "peer-checked:border-primary-500 peer-checked:bg-primary-500",
          "peer-focus-visible:ring-[3px] peer-focus-visible:ring-primary-500/30",
          "peer-checked:[&>svg]:opacity-100",
          error && "border-danger-500",
        )}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 12 10"
          className="h-[10px] w-3 text-white opacity-0 transition-opacity"
        >
          <path
            d="M1 5 L4.5 8.5 L11 1.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span>{children}</span>
    </label>
  );
});
