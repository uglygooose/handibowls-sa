"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { restoreAccount } from "@/app/(player)/(gated)/me/_actions";

// Phase 13 / 13-2b / Batch H2 — Restore-account button used by
// GraceWindowBanner. Calls the Batch G1 restoreAccount action;
// on success, router.refresh() re-fetches the layout's
// getCurrentProfile (now with deleted_at = NULL) so the banner
// disappears on the next render.

export function RestoreAccountButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await restoreAccount();
      switch (result.kind) {
        case "restored":
          toast.success("Account restored.");
          router.refresh();
          break;
        case "not_eligible":
          toast.error(
            "Your account isn't pending deletion — nothing to restore.",
          );
          router.refresh();
          break;
        case "auth":
          toast.error("Not authenticated. Please sign in again.");
          break;
        case "error":
          toast.error(`Could not restore: ${result.error}`);
          break;
      }
    });
  }

  return (
    <Button
      variant="primary"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
      data-slot="restore-account-button"
    >
      {isPending ? "Restoring…" : "Restore account"}
    </Button>
  );
}
