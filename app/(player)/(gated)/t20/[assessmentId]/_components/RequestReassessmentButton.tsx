"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { requestT20Assessment } from "../../_actions";

// Phase 12.5 / 12.5-4: re-assessment CTA on the player results
// detail view. Wires to the existing `requestT20Assessment` action
// (Phase 12-1 followup) — same in-app message → admin path the
// hub's "Request assessment" button uses. Locked decision at
// 12.5-prep: copy is "Request re-assessment" (mirrors the existing
// "Request assessment" pattern).
//
// Reuses the visual weight of the hub button (12px mono uppercase
// label, same primary-foreground-on-bone treatment) so a player
// landing here from the hub recognises the affordance.

type Props = {
  /** Disabled when the player has no club memberships at all. */
  disabled?: boolean;
};

export function RequestReassessmentButton({ disabled = false }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (disabled || pending) return;
    startTransition(async () => {
      const result = await requestT20Assessment();
      switch (result.kind) {
        case "ok":
          toast.success("Re-assessment requested", {
            description: `Sent to ${result.recipientCount} admin${
              result.recipientCount === 1 ? "" : "s"
            } at ${result.clubName}.`,
          });
          break;
        case "throttled":
          toast.message("Already requested", {
            description: `You've already asked ${result.clubName} for an assessment in the last 24 hours.`,
          });
          break;
        case "no_admins":
          toast.error("No admins to notify", {
            description: `${result.clubName} has no club admin. Contact a super-admin to set one up.`,
          });
          break;
        case "no_club":
          toast.error("No club found", {
            description: "You're not an active member of any club yet.",
          });
          break;
        case "wrong_club":
          toast.error("Membership inactive", {
            description:
              "Your membership at the target club isn't active. Contact a club admin.",
          });
          break;
        case "not_authenticated":
          toast.error("Sign in again", {
            description:
              "Your session expired. Sign in to request a re-assessment.",
          });
          break;
        case "error":
          toast.error("Couldn't send the request", {
            description: result.message,
          });
          break;
      }
    });
  }

  return (
    <button
      type="button"
      data-slot="request-reassessment-cta"
      onClick={handleClick}
      disabled={disabled || pending}
      className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] bg-bone px-5 font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-primary-600 hover:bg-bone/95 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Requesting…
        </>
      ) : (
        <>
          Request re-assessment
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </>
      )}
    </button>
  );
}
