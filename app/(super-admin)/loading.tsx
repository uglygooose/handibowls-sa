import { Skeleton } from "@/components/ui/skeleton";

// Phase 12.5 / 12.5-6 (K / `loading-spinner-only`) — same shape as
// the club-admin role-level loading: AdminPageHero shell + 3-row
// list skeleton. Mirrors the dominant platform surface shape
// (Clubs / Users / Districts lists). Per-route loading.tsx files
// under /platform/{clubs,users,districts} ship their own
// AdminPageHero-shaped trees; this is the role-group fallback.
export default function SuperAdminLoading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <div
        data-slot="loading-admin-page-hero"
        className="relative overflow-hidden rounded-[18px] border border-border bg-bone px-9 py-8"
      >
        <div className="flex min-h-[156px] flex-col justify-end gap-2.5">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-12 w-72" />
          <Skeleton className="h-3 w-96" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}
