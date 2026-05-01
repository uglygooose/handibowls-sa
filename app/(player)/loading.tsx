import { Skeleton } from "@/components/ui/skeleton";

// Phase 12.5 / 12.5-6 (K / `loading-spinner-only`) — Skeleton tree
// shaped like a typical player surface: max-w-3xl mobile-shaped
// container with a small h1 row + 2-3 card rectangles. Mirrors the
// /play / /tournaments / /book list shape (no AdminPageHero — those
// are admin surfaces).
export default function PlayerLoading() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-5 pt-5 pb-24">
      <div className="flex flex-col gap-1">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-56" />
      </div>
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
