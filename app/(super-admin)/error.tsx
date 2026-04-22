"use client";

import { Button } from "@/components/ui/button";

export default function SuperAdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="space-y-3 p-6 text-center">
      <h1 className="font-display text-xl font-bold text-ink">
        Something went wrong
      </h1>
      <p className="text-sm text-ink-muted">{error.message}</p>
      <Button onClick={reset}>Try again</Button>
    </div>
  );
}
