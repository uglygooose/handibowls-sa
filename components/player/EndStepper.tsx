"use client";

import { Minus, Plus } from "lucide-react";

import { cn } from "@/lib/utils";

// Phase 8c — +/− stepper for the current end's shots-won. Two visual
// modes: default (56×56 buttons, surface bg) and wet-hands (64×64
// buttons with thick borders + amber/black amped contrast for wet
// greens in direct sunlight). Wet-hands mode is the design's "ugly is
// good" treatment — explicit width and border-thickness spec from
// the brief.
//
// Caller-controlled value + min/max. EndStepper doesn't write to
// Dexie itself — the scorecard surface owns the optimistic write
// chain so it can pair the +/− with the matching teammate's reset
// (per the design source: the team that didn't win the end gets
// reset to 0 when the opposing team's count goes up).

type Props = {
  /** Team-side label rendered above the buttons. "YOU" / "OPP" / etc. */
  label: string;
  value: number;
  /** Hard cap. Singles + pairs cap at 4 bowls × N players; the design
   *  uses 8 as a comfortable upper bound for any format. */
  min?: number;
  max?: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Wet-hands mode — switches buttons to 64×64 + thick black border
   *  + amber-on-black tone. Sourced from the scorecard's
   *  data-wet-hands="on" root attribute via useWetHands. */
  wetHands?: boolean;
  /** Optional secondary tone. "you" / "opp" tints the active state. */
  tone?: "neutral" | "you" | "opp";
  className?: string;
};

export function EndStepper({
  label,
  value,
  min = 0,
  max = 8,
  onIncrement,
  onDecrement,
  wetHands = false,
  tone = "neutral",
  className,
}: Props) {
  const decrementDisabled = value <= min;
  const incrementDisabled = value >= max;
  const active = value > 0;

  return (
    <div
      data-slot="end-stepper"
      data-wet-hands={wetHands}
      data-tone={tone}
      data-active={active}
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border bg-surface p-3 transition-colors",
        wetHands
          ? "border-[6px] border-[#0A0A0A] bg-[#1a1a1a] text-[#f5b700]"
          : "border-border",
        active && tone === "you" && !wetHands && "border-primary-500 bg-primary-500/8",
        active && tone === "opp" && !wetHands && "border-warning-500 bg-warning-500/8",
        className,
      )}
    >
      <span
        className={cn(
          "font-mono font-extrabold uppercase tracking-[0.12em]",
          wetHands ? "text-[14px] text-[#f5b700]" : "text-[10.5px] text-ink-muted",
        )}
      >
        {label}
      </span>

      <div className="flex items-center gap-3">
        <StepperButton
          aria-label={`${label} decrease`}
          onClick={onDecrement}
          disabled={decrementDisabled}
          icon={<Minus />}
          wetHands={wetHands}
        />
        <span
          className={cn(
            "font-display font-black italic leading-none tabular-nums",
            wetHands ? "min-w-[48px] text-center text-[56px] text-[#f5b700]" : "min-w-[40px] text-center text-[40px]",
          )}
        >
          {value}
        </span>
        <StepperButton
          aria-label={`${label} increase`}
          onClick={onIncrement}
          disabled={incrementDisabled}
          icon={<Plus />}
          wetHands={wetHands}
        />
      </div>

      <span
        className={cn(
          "font-mono uppercase tracking-[0.08em]",
          wetHands ? "text-[10px] text-[#c08f00]" : "text-[10px] text-ink-subtle",
        )}
      >
        Shots won
      </span>
    </div>
  );
}

function StepperButton({
  onClick,
  disabled,
  icon,
  wetHands,
  ...rest
}: {
  onClick: () => void;
  disabled: boolean;
  icon: React.ReactNode;
  wetHands: boolean;
  "aria-label": string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-slot="stepper-btn"
      className={cn(
        // Touch target: 56×56 default, 64×64 wet-hands (per brief).
        // Border thickness amped in wet-hands mode for a high-contrast
        // visible edge in sunlight.
        "inline-flex shrink-0 items-center justify-center rounded-[14px] transition-colors active:scale-95",
        wetHands
          ? "size-16 border-[8px] border-[#f5b700] bg-[#0A0A0A] text-[#f5b700] disabled:opacity-50"
          : "size-14 border border-border bg-surface text-ink hover:bg-surface-muted disabled:opacity-50",
      )}
      {...rest}
    >
      <span className={wetHands ? "[&>svg]:size-7 [&>svg]:stroke-[3]" : "[&>svg]:size-6"}>
        {icon}
      </span>
    </button>
  );
}
