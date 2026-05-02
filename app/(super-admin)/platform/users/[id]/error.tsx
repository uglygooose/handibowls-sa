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
    <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 pb-24">
      <AdminPageHero containerWidth="none" eyebrow="Platform · User" title="Error" />
      <div>
        <div className="max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
          <p className="font-medium text-destructive">Could not load this user.</p>
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
