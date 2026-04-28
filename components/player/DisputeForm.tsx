"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/utils";

// Phase 8c — dispute form opened from <OpponentConfirmationCard /> when
// the opposing captain's submitted score doesn't match the player's
// view. Posts an alternative home/away score pair + a free-text
// reason; the calling surface decides what to do with it (8d wires
// the dispute through to a server action; until then disputes are
// stored client-side as a flag on the submission row).
//
// Schema validation via Zod 4 + react-hook-form's resolver, matching
// the Phase 4c.6 pattern that fixed the Zod 4 / hookform resolver
// drift.

const schema = z.object({
  // RHF passes a number when valueAsNumber: true; the schema validates
  // the final shape, no z.coerce needed (avoiding the unknown→number
  // resolver typing drift in Zod 4).
  home_shots: z
    .number()
    .int("Whole numbers only")
    .min(0, "Can't be negative")
    .max(99, "Too high"),
  away_shots: z
    .number()
    .int("Whole numbers only")
    .min(0, "Can't be negative")
    .max(99, "Too high"),
  reason: z
    .string()
    .trim()
    .min(8, "Tell us at least a sentence about the disagreement")
    .max(500, "Keep it under 500 characters"),
});

export type DisputePayload = z.infer<typeof schema>;

type Props = {
  /** Pre-fill the form with what the opponent submitted, so the player
   *  can edit either field rather than typing from scratch. */
  initial: { home_shots: number; away_shots: number };
  /** The names rendered above each score input. Defaults sensible. */
  yourLabel?: string;
  opponentLabel?: string;
  onSubmit: (payload: DisputePayload) => Promise<void> | void;
  onCancel: () => void;
  className?: string;
};

export function DisputeForm({
  initial,
  yourLabel = "Your team",
  opponentLabel = "Opponents",
  onSubmit,
  onCancel,
  className,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DisputePayload>({
    resolver: zodResolver(schema),
    defaultValues: {
      home_shots: initial.home_shots,
      away_shots: initial.away_shots,
      reason: "",
    },
  });

  return (
    <form
      data-slot="dispute-form"
      onSubmit={handleSubmit((v) => onSubmit(v))}
      className={cn("flex flex-col gap-3 px-4 pt-2", className)}
    >
      <h3 className="font-display text-[22px] font-black italic uppercase leading-none tracking-tight">
        Dispute scores
      </h3>
      <p className="text-[13px] text-ink-muted">
        Adjust either side to what you have. The opposing captain sees your
        submission alongside theirs; admin verifies the resolution.
      </p>

      <div className="grid grid-cols-2 gap-2">
        <ScoreField
          label={yourLabel}
          {...register("home_shots", { valueAsNumber: true })}
          error={errors.home_shots?.message}
        />
        <ScoreField
          label={opponentLabel}
          {...register("away_shots", { valueAsNumber: true })}
          error={errors.away_shots?.message}
        />
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
          What&apos;s the disagreement?
        </span>
        <textarea
          {...register("reason")}
          rows={4}
          placeholder="e.g. End 6 — we both played 3 bowls, scored 2 not 3"
          className="rounded-xl border border-border bg-surface px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        {errors.reason && (
          <span className="text-[12px] text-danger-500">
            {errors.reason.message}
          </span>
        )}
      </label>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface text-[13px] font-medium text-ink hover:bg-surface-muted disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex h-11 flex-[2] items-center justify-center rounded-xl bg-danger-500 text-[13px] font-extrabold uppercase tracking-[0.04em] text-white hover:opacity-90 disabled:opacity-60"
        >
          {isSubmitting ? "Submitting…" : "Submit dispute"}
        </button>
      </div>
    </form>
  );
}

function ScoreField({
  label,
  error,
  ...rest
}: {
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        {label}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        className="h-12 rounded-xl border border-border bg-surface px-3 text-center font-display text-[28px] font-black italic tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-500"
        {...rest}
      />
      {error && <span className="text-[12px] text-danger-500">{error}</span>}
    </label>
  );
}
