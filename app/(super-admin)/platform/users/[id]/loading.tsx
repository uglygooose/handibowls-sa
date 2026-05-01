import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col">
      <AdminPageHero containerWidth="none" eyebrow="Platform · User" title="Loading…" />
      <div className="flex flex-col gap-6 px-6 py-6">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-44 w-full rounded-xl" />
      </div>
    </div>
  );
}
