"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { requestAccountDeletion } from "@/app/(player)/(gated)/me/_actions";

// Phase 13 / 13-2b / Batch H2 — destructive-confirm card for
// requestAccountDeletion.
//
// Two-stage confirmation: AlertDialog open + explicit
// "I understand" checkbox + click on the danger-variant
// Confirm button. The checkbox blocks the Confirm button
// until checked; AlertDialog's modal trap prevents accidental
// dismiss-by-click-outside.
//
// On success: redirect to /me. The (player)(gated) layout's
// GraceWindowBanner (sibling Server Component) reads the new
// deleted_at + renders the banner with the Restore CTA.
//
// On last_super_admin_block: surface a friendly toast explaining
// the constraint instead of redirecting. Other error kinds:
// generic toast.

export function DeleteAccountCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await requestAccountDeletion();
      switch (result.kind) {
        case "scheduled":
        case "already_scheduled":
          setOpen(false);
          toast.success(
            "Your account is scheduled for deletion. You can restore it anytime in the next 30 days by signing in.",
          );
          router.push("/me");
          router.refresh();
          break;
        case "last_super_admin_block":
          toast.error(
            "Cannot delete the only super-admin. Promote another user to super-admin first.",
          );
          break;
        case "auth":
          toast.error("Not authenticated. Please sign in again.");
          break;
        case "error":
          toast.error(`Could not schedule deletion: ${result.error}`);
          break;
      }
    });
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-[14px] border border-danger-500/40 bg-danger-500/5 p-5"
      data-slot="delete-account-card"
    >
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[18px] font-bold tracking-tight">
          Delete my account
        </h2>
        <p className="text-[13.5px] text-ink-muted">
          Schedules your account for deletion in 30 days. Until
          then, signing back in will restore your account in full.
          After 30 days, your personal information (name, email,
          phone, BSA number) is permanently anonymised. Match
          history and tournament records you participated in are
          preserved for other players&rsquo; legitimate records,
          but display you as &ldquo;Deleted player&rdquo;.
        </p>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setUnderstood(false);
        }}
      >
        <AlertDialogTrigger asChild>
          <Button
            variant="danger"
            size="md"
            className="w-fit"
            data-slot="delete-account-trigger"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Your account will be scheduled for deletion in 30
              days. During the grace window you can restore it by
              signing in. After 30 days, your personal information
              is permanently anonymised and you will be signed out.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-bone p-3 text-[13px]">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
              className="mt-0.5 size-4 cursor-pointer"
              data-slot="delete-account-confirm-check"
            />
            <span>
              I understand my account will be scheduled for
              deletion and that anonymisation after the 30-day
              grace window is permanent.
            </span>
          </label>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="danger"
              disabled={!understood || isPending}
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              data-slot="delete-account-confirm"
            >
              {isPending ? "Scheduling…" : "Delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
