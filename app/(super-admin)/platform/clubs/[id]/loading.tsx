import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col">
      <PageHeader eyebrow="Platform · Clubs" title="Loading…" />
      <div className="px-6 py-6">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
