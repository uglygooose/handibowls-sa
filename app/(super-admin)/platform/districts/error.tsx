"use client";

import { Button } from "@/components/ui/button";
import { AdminPageHero } from "@/components/layout/AdminPageHero";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col">
      <AdminPageHero containerWidth="none" eyebrow="Platform" title="Districts" />
      <div className="px-6 py-10">
        <div className="max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-destructive">Could not load districts.</p>
          <p className="mt-1 text-ink-muted">{error.message || "Unknown error."}</p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={() => reset()}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
