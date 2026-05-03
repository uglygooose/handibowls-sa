import { Skeleton } from "@/components/ui/skeleton";

// Phase 12.5 / 12.5-6 (K / `loading-spinner-only`) — Skeleton tree
// shaped like a typical club-admin surface: AdminPageHero card
// (rounded-[18px] / min-h-[156px]) + a 3-row list shell. Mirrors
// the dominant club-admin sidebar surface shape (Tournaments / T20
// / Messages / Members lists). Hydration on a real page replaces
// this with the same hero outline + real content, so the layout
// shift is minimal.
export default function ClubAdminLoading() {
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
        <Skeleton className="h-20 w-full rounded-[14px]" />
        <Skeleton className="h-20 w-full rounded-[14px]" />
        <Skeleton className="h-20 w-full rounded-[14px]" />
      </div>
    </div>
  );
}
