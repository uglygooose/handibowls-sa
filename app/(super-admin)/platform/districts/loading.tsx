import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col">
      <PageHeader eyebrow="Platform" title="Districts" />
      <div className="flex flex-col gap-3 px-6 py-6">
        <Skeleton className="h-9 w-32 self-end" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  );
}
