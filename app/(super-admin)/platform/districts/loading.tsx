import { AdminPageHero } from "@/components/layout/AdminPageHero";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero containerWidth="none" eyebrow="Platform" title="Districts" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-32 self-end" />
        <Skeleton className="h-80 w-full rounded-[14px]" />
      </div>
    </div>
  );
}
