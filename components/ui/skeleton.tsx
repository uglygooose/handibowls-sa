import { cn } from "@/lib/utils"

// Phase 13 / 13-1 / commit 9 — aria-busy="true" so screen readers
// announce the loading state. Without it, the visible pulse animation
// is silent to assistive tech and content "appearing later" feels
// abrupt. Caller can override via spread props if a specific consumer
// needs different ARIA semantics.
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-busy="true"
      aria-live="polite"
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
