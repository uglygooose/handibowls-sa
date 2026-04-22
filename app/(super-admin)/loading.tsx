import { Skeleton } from "@/components/ui/skeleton";

export default function SuperAdminLoading() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
