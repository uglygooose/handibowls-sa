import * as React from "react"

import { cn } from "@/lib/utils"

// Phase 12.5 / 12.5-1: bumped from h-8 (32px) to h-10 (40px) to align
// with the locked form-control height scale documented in
// app/globals.css (default 40 / primary CTA 44 / mobile-block 48).
// The shadcn upstream default of 32px was the drift, not the spec —
// touch targets at 32px fail the Apple HIG 44px minimum on mobile and
// read as cramped on desktop. Auth `Field.tsx` ships `h-13` (52px)
// for its mobile-form-heavy context — documented exception, not drift.

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Input }
