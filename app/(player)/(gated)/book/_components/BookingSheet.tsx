"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { BottomSheet } from "@/components/player/BottomSheet";
import { cn } from "@/lib/utils";

import { createBooking } from "../_actions";
import { purposeLabel } from "../slots";

// Phase 8e-2 — bottom-sheet booking form. Owns the form state, the
// pending-submit transition, and the toast/refresh on success or
// race-conflict. Server action returns typed errors per
// `CreateBookingResult`; the sheet maps each kind to the correct
// UX:
//
//   • ok              → toast + close + router.refresh
//   • slot_conflict   → toast (taken) + close + router.refresh
//                       (the slot grid will reflect the truth)
//   • no_availability → toast (no rinks left) + close + router.refresh
//   • validation/auth/error → inline error in the sheet, leave open
//
// Form-level Zod mirrors the action's schema so client validation
// catches obvious mistakes before the round-trip; the action
// re-validates as the authoritative gate.

const formSchema = z.object({
  purpose: z.enum(["roll_up", "practice", "coaching", "match", "social"]),
  party_size: z.number().int().min(1).max(8),
  notes: z
    .string()
    .trim()
    .max(500, "Notes are capped at 500 characters.")
    .optional(),
});

type FormValues = z.infer<typeof formSchema>;

const PURPOSES = [
  "roll_up",
  "practice",
  "coaching",
  "match",
  "social",
] as const;

export type Slot = {
  starts_at: string;
  ends_at: string;
  starts_label: string;
  ends_label: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: Slot;
  clubName: string;
};

export function BookingSheet({ open, onOpenChange, slot, clubName }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      purpose: "practice",
      party_size: 2,
      notes: "",
    },
  });

  // Reset form whenever the sheet re-opens for a new slot — otherwise
  // the previous entry persists and a player tapping a different
  // slot sees stale state.
  useEffect(() => {
    if (open) {
      reset({ purpose: "practice", party_size: 2, notes: "" });
    }
  }, [open, slot.starts_at, reset]);

  const purpose = watch("purpose");
  const partySize = watch("party_size");

  function adjustParty(delta: number) {
    const next = Math.max(1, Math.min(8, partySize + delta));
    setValue("party_size", next, { shouldValidate: true, shouldDirty: true });
  }

  function setPurpose(p: FormValues["purpose"]) {
    setValue("purpose", p, { shouldValidate: true, shouldDirty: true });
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createBooking({
        slot_starts_at: slot.starts_at,
        slot_ends_at: slot.ends_at,
        purpose: values.purpose,
        party_size: values.party_size,
        notes: values.notes?.trim() ? values.notes.trim() : undefined,
      });

      switch (result.kind) {
        case "ok":
          toast.success("Booked.", {
            description: `${slot.starts_label}–${slot.ends_label} · ${purposeLabel(values.purpose)}`,
          });
          onOpenChange(false);
          router.refresh();
          return;
        case "slot_conflict":
          toast.error("That slot was just booked — try another.");
          onOpenChange(false);
          router.refresh();
          return;
        case "no_availability":
          toast.error("All rinks are booked for that slot.");
          onOpenChange(false);
          router.refresh();
          return;
        case "auth":
          toast.error(result.error);
          onOpenChange(false);
          return;
        case "validation":
        case "error":
          // Inline only — leave the sheet open so the player can
          // adjust + retry without re-typing.
          toast.error(result.error);
          return;
      }
    });
  }

  const submitting = pending || isSubmitting;

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheet.Content className="px-5 pt-1">
        <BottomSheet.Title className="font-display text-[22px] font-black uppercase italic tracking-tight">
          Book this slot
        </BottomSheet.Title>
        <BottomSheet.Description className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
          {clubName} · {slot.starts_label}–{slot.ends_label}
        </BottomSheet.Description>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="mt-4 flex flex-col gap-4"
          data-slot="booking-form"
        >
          {/* Purpose chips */}
          <fieldset>
            <legend className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              Purpose
            </legend>
            <div className="flex flex-wrap gap-1.5" role="radiogroup">
              {PURPOSES.map((p) => {
                const active = purpose === p;
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    data-purpose={p}
                    onClick={() => setPurpose(p)}
                    className={cn(
                      "h-9 rounded-lg border px-3 text-[13px] font-bold uppercase tracking-[0.04em] transition-colors",
                      active
                        ? "border-ink bg-ink text-ink-inverse"
                        : "border-border bg-bone text-ink hover:border-ink/40",
                    )}
                  >
                    {purposeLabel(p)}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Party stepper */}
          <fieldset>
            <legend className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">
              Party size
            </legend>
            <div
              className="inline-flex items-center gap-3 rounded-xl border border-border bg-bone px-3 py-2"
              data-slot="party-stepper"
            >
              <button
                type="button"
                aria-label="Decrease party size"
                disabled={partySize <= 1}
                onClick={() => adjustParty(-1)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border border-border text-ink",
                  "hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span
                className="min-w-6 text-center font-display text-[24px] font-black tabular-nums leading-none"
                data-slot="party-value"
              >
                {partySize}
              </span>
              <button
                type="button"
                aria-label="Increase party size"
                disabled={partySize >= 8}
                onClick={() => adjustParty(1)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-md border border-border text-ink",
                  "hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50",
                )}
              >
                <Plus className="size-4" aria-hidden="true" />
              </button>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-ink-muted">
                bowlers
              </span>
            </div>
          </fieldset>

          {/* Notes */}
          <fieldset>
            <label
              htmlFor="booking-notes"
              className="mb-2 block font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted"
            >
              Notes (optional)
            </label>
            <textarea
              id="booking-notes"
              {...register("notes")}
              rows={3}
              maxLength={500}
              className={cn(
                "w-full resize-none rounded-lg border border-border bg-bone px-3 py-2",
                "text-[14px] text-ink placeholder:text-ink-muted",
                "focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10",
              )}
              placeholder="Coaching session, drill focus, etc."
            />
            {errors.notes && (
              <p
                role="alert"
                className="mt-1 text-[12px] text-danger-500"
                data-slot="notes-error"
              >
                {errors.notes.message}
              </p>
            )}
          </fieldset>

          {/* Actions */}
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
              className={cn(
                "flex h-12 flex-1 items-center justify-center rounded-lg border border-border bg-bone",
                "text-[14px] font-extrabold uppercase tracking-[0.04em] text-ink",
                "disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-slot="submit"
              className={cn(
                "flex h-12 flex-[2] items-center justify-center gap-2 rounded-lg bg-primary-500",
                "text-[14px] font-extrabold uppercase tracking-[0.04em] text-on-primary",
                "disabled:cursor-not-allowed disabled:opacity-60",
              )}
            >
              {submitting && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Confirm booking
            </button>
          </div>
        </form>
      </BottomSheet.Content>
    </BottomSheet>
  );
}
