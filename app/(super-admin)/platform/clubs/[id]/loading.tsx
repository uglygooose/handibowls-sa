import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero containerWidth="none" eyebrow="Platform · Clubs" title="Loading…" />
      <div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
