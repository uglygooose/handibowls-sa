"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { requestT20Assessment } from "../_actions";

// Phase 12 / 12-1 followup — Client island wrapping the
// requestT20Assessment server action. Renders the hero CTA inside
// the otherwise-server-rendered /t20 hero band, captures the result,
// and surfaces a sonner toast keyed off the result kind.
//
// The button stays visually identical to the 12-1 white-on-primary
// hero CTA — only the click handler + pending state change.

type Props = {
  /** Disabled when the player has no club memberships at all. The
   *  CTA is hidden by the parent in that case, but we double-guard
   *  here so a stray prop doesn't fire an action that returns
   *  no_club anyway. */
  disabled?: boolean;
};

export function RequestAssessmentButton({ disabled = false }: Props) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (disabled || pending) return;
    startTransition(async () => {
      const result = await requestT20Assessment();
      switch (result.kind) {
        case "ok":
          toast.success("Assessment requested", {
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
            description: "Your session expired. Sign in to request an assessment.",
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
      onClick={handleClick}
      disabled={disabled || pending}
      className="mt-2 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[10px] bg-white font-mono text-[12px] font-bold uppercase tracking-[0.08em] text-primary-600 hover:bg-white/95 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
          Requesting…
        </>
      ) : (
        <>
          Request assessment
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </>
      )}
    </button>
  );
}
