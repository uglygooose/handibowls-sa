"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  // Whether the filter is currently applied. Drives the inverted (ink bg)
  // treatment per the design.
  active?: boolean;
  // Optional count badge shown to the right of the label — used when a
  // multi-select filter has N selections.
  count?: number;
  // Dashed border + reduced visual weight, used for the "Clear" reset
  // chip per the design.
  variant?: "default" | "dashed";
  children: ReactNode;
};

// Filter chip per the Claude Design treatment: rounded-full pill, 1.5px
// border, hover bumps to ink, on-state inverts to ink bg + ink-inverse fg.
// Used in the clubs list filter row and the audit-log filter chips.
export function FilterChip({
  active = false,
  count,
  variant = "default",
  className,
  children,
  ...props
}: Props) {
  return (
    <button
      type="button"
      data-slot="filter-chip"
      data-active={active || undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3.5 py-2",
        "border-[1.5px] text-[13px] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-ink text-ink-inverse border-ink"
          : "bg-bone text-ink-muted border-border hover:border-ink hover:text-ink",
        variant === "dashed" && "border-dashed",
        className,
      )}
      {...props}
    >
      {children}
      {typeof count === "number" && count > 0 && (
        <span className="rounded-full bg-primary-500 px-1.5 py-px font-mono text-[10px] font-bold text-on-primary">
          {count}
        </span>
      )}
    </button>
  );
}
