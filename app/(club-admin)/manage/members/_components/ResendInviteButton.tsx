"use client";

import { Loader2, RotateCcw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { resendInviteEmail } from "@/lib/invites/actions";

import type { InviteEmailStatus } from "../_data";

// Phase 12 / 12-3 / A2 — Resend invite email button.
//
// Renders inline next to the invite-row Status badge in MembersTable.
// Visibility: shown when invite_email_status is null / 'failed' /
// 'skipped'. Hidden on invite_email_status='sent' (no need to resend
// a successful send) — though future UX may want a "send again"
// affordance for the sent case too; out of scope for v1.
//
// Click → resendInviteEmail action → toast keyed off the result.
// revalidatePath inside the action surfaces the new email_status
// without a manual refresh.

type Props = {
  token: string;
  emailStatus: InviteEmailStatus;
  recipientLabel: string;
};

export function ResendInviteButton({ token, emailStatus, recipientLabel }: Props) {
  const [pending, startTransition] = useTransition();

  // Hide for already-sent invites — they don't need a resend
  // (status='sent' = Resend accepted the email at some prior attempt).
  if (emailStatus === "sent") return null;

  function handleClick() {
    if (pending) return;
    startTransition(async () => {
      const result = await resendInviteEmail(token);
      switch (result.kind) {
        case "ok":
          if (result.status === "sent") {
            toast.success("Invite resent", {
              description: `Sent to ${recipientLabel}.`,
            });
          } else if (result.status === "skipped") {
            toast.message("Send skipped", {
              description: `${recipientLabel} has opted out of email. Share the accept link manually.`,
            });
          } else {
            toast.error("Send failed", {
              description: result.error ?? "Unknown error — try again later.",
            });
          }
          return;
        case "not_found":
          toast.error("Invite not found");
          return;
        case "wrong_club":
          toast.error("Wrong club", {
            description: "That invite belongs to a different club.",
          });
          return;
        case "wrong_role":
          toast.error("Permission denied");
          return;
        case "not_authenticated":
          toast.error("Sign in again");
          return;
        case "error":
          toast.error("Couldn't resend", { description: result.message });
          return;
      }
    });
  }

  // emailStatus at this point is null | 'failed' | 'skipped' (we
  // returned early on 'sent' above). Both attempted-but-not-successful
  // states render "Resend"; null (never attempted) renders "Send".
  const label = emailStatus === null ? "Send" : "Resend";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      data-slot="resend-invite-button"
      data-email-status={emailStatus ?? "null"}
      className="ml-2 inline-flex h-6 items-center gap-1 rounded-md border border-border bg-bone px-2 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="size-3 animate-spin" aria-hidden="true" />
      ) : (
        <RotateCcw className="size-3" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}
