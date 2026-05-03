"use client";

import { Loader2, Power } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

import { updateRinkActive } from "../_actions";

// Phase 9-1 — per-rink active/inactive switch with maintenance reason.
//
// State machine
//   active=true  → toggle button ("Disable")
//   active=false → toggle button ("Enable") — no reason needed to re-enable
//   pending toggle to inactive → inline reason form (textarea + Submit / Cancel)
//
// Reason persistence is deferred — see `_actions.ts:updateRinkActive`
// comment. The reason field is captured + surfaced in the success
// toast for the immediate session; the audit_log row lands when
// migration 031's `audit_log_visible_to_admin` extends to
// table_name='rinks' (Phase 9-2 or 12.5).

type Props = {
  rinkId: string;
  rinkLabel: string;
  active: boolean;
};

export function RinkDisableToggle({ rinkId, rinkLabel, active }: Props) {
  const [pending, startTransition] = useTransition();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  function disable() {
    if (active) {
      setReasonOpen(true);
      return;
    }
    // Re-enable path — no reason form, fire directly.
    submit({ active: true });
  }

  function submitDisable() {
    const trimmed = reason.trim();
    if (trimmed.length === 0) {
      setReasonError("Reason is required when disabling a rink.");
      return;
    }
    if (trimmed.length > 500) {
      setReasonError("Reason must be 500 characters or fewer.");
      return;
    }
    setReasonError(null);
    submit({ active: false, reason: trimmed });
  }

  function submit(payload: { active: boolean; reason?: string }) {
    startTransition(async () => {
      const result = await updateRinkActive({ rink_id: rinkId, ...payload });
      if (result.ok) {
        if (payload.active) {
          toast.success(`${rinkLabel} re-enabled.`);
        } else {
          toast.success(`${rinkLabel} disabled.`, {
            description: payload.reason
              ? `Maintenance: ${payload.reason}`
              : undefined,
          });
        }
        setReasonOpen(false);
        setReason("");
        return;
      }
      toast.error(result.kind === "validation" ? result.error : (result.error ?? "Update failed."));
    });
  }

  function cancelReason() {
    setReasonOpen(false);
    setReason("");
    setReasonError(null);
  }

  return (
    <div
      data-slot="rink-disable-toggle"
      data-rink-id={rinkId}
      data-active={active}
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-border bg-bone p-3",
        !active && "opacity-90",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            data-slot="rink-status-dot"
            aria-hidden="true"
            className={cn(
              "inline-block size-2 rounded-full",
              active ? "bg-success-500" : "bg-warning-500",
            )}
          />
          <span className="font-display text-[14px] font-extrabold tracking-tight">
            {rinkLabel}
          </span>
          <span
            data-slot="rink-status-label"
            className={cn(
              "font-mono text-[10px] font-bold uppercase tracking-[0.06em]",
              active ? "text-success-700" : "text-warning-700",
            )}
          >
            {active ? "ACTIVE" : "MAINTENANCE"}
          </span>
        </div>
        {!reasonOpen && (
          <button
            type="button"
            onClick={disable}
            disabled={pending}
            data-slot="toggle-cta"
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-3",
              "text-[12px] font-extrabold uppercase tracking-[0.04em]",
              // Phase 13 / 13-3 / Batch J — hover-state contrast fix.
              // Default-state text-{tone}-700 on bg-bone passes AA, but
              // composited contrast drops below 4.5:1 when hover:bg-{tone}-500/8
              // tints the bg. Mirror the hover:bg variant with hover:text-ink
              // so the foreground swaps to theme-invariant ink only mid-hover
              // — preserves the brand-tone cue in default state (carried by
              // border + text colour) and only intervenes when the bg shift
              // breaks the contrast pair.
              active
                ? "border-warning-500/60 bg-bone text-warning-700 hover:bg-warning-500/8 hover:text-ink"
                : "border-success-500/60 bg-bone text-success-700 hover:bg-success-500/8 hover:text-ink",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {pending ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <Power className="size-3" aria-hidden="true" />
            )}
            {active ? "Disable" : "Enable"}
          </button>
        )}
      </div>

      {reasonOpen && (
        <div
          data-slot="reason-form"
          className="flex flex-col gap-2 rounded-md bg-surface p-2"
        >
          <label
            htmlFor={`reason-${rinkId}`}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted"
          >
            Maintenance reason (required)
          </label>
          <textarea
            id={`reason-${rinkId}`}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              if (reasonError) setReasonError(null);
            }}
            rows={2}
            maxLength={500}
            disabled={pending}
            data-slot="reason-textarea"
            className={cn(
              "resize-none rounded-md border border-border bg-bone px-2 py-1.5 text-[13px]",
              "focus:border-ink/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-bone",
            )}
            placeholder="e.g. Rink resurfacing — back online Saturday."
          />
          {reasonError && (
            <p
              role="alert"
              data-slot="reason-error"
              className="text-[11.5px] text-danger-500"
            >
              {reasonError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={cancelReason}
              disabled={pending}
              className={cn(
                "h-8 flex-1 rounded-md border border-border bg-bone",
                "text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submitDisable}
              disabled={pending}
              data-slot="reason-submit"
              className={cn(
                "h-8 flex-[2] rounded-md bg-warning-500/90 px-3",
                "text-[12px] font-extrabold uppercase tracking-[0.04em] text-bone",
                "hover:bg-warning-500 disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {pending ? (
                <Loader2
                  className="mx-auto size-3.5 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                "Disable rink"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
