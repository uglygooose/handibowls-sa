import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col">
      <AdminPageHero containerWidth="none" eyebrow="Platform" title="Clubs" />
      <div className="flex flex-col gap-3 px-6 py-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}
