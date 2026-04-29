"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { SECTION_KEYS, type SectionKey } from "@/lib/t20/rubric";

// Phase 10 — section-by-round capture progress strip.
//
// Renders a 7-column × 2-row grid: one column per Twenty 20 section
// (jacks, targets, drive, control, trail, speedhumps_asc,
// speedhumps_desc), each split into R1 / R2 buttons. The capture
// wizard renders this in its sticky header so the assessor sees
// completion state at a glance + can jump back to any earlier
// (section, round) tuple.
//
// State per cell:
//   current  highlighted with primary-500 border + ring
//   done     filled primary-500 + checkmark
//   todo     bone background + border-strong
//
// Section labels are short — Barlow Condensed 9px caps for density.
// The mono "R1 / R2" labels are 11px JetBrains. Visual rhythm
// matches RinkHeatmap (mono-caps headers + tight grid).

const SECTION_SHORT_LABEL: Record<SectionKey, string> = {
  jacks: "Jacks",
  targets: "Targets",
  drive: "Drive",
  control: "Control",
  trail: "Trail",
  speedhumps_asc: "Speedhumps ↑",
  speedhumps_desc: "Speedhumps ↓",
};

export type StepperSection = {
  key: SectionKey;
  /** Optional override label — defaults to the canonical short label. */
  label?: string;
};

export type StepperState = {
  /** 0..6 index into SECTION_KEYS. */
  sectionIdx: number;
  /** Current round, 1 or 2. */
  round: 1 | 2;
};

type Props = {
  /** When omitted, renders the canonical 7 sections in order. */
  sections?: StepperSection[];
  current: StepperState;
  /** Map of `${sectionKey}_r${round}` → true when that round is done. */
  completed: Record<string, boolean>;
  onJump?: (sectionIdx: number, round: 1 | 2) => void;
  className?: string;
};

export function SectionStepper({
  sections,
  current,
  completed,
  onJump,
  className,
}: Props) {
  const list: StepperSection[] = sections ?? SECTION_KEYS.map((k) => ({ key: k }));
  return (
    <div
      data-slot="section-stepper"
      className={cn("flex items-stretch gap-1.5", className)}
    >
      {list.map((sec, sidx) => (
        <div
          key={sec.key}
          data-slot="stepper-section"
          data-section={sec.key}
          className="flex min-w-0 flex-1 flex-col gap-[3px]"
        >
          <div
            data-slot="section-label"
            className="overflow-hidden whitespace-nowrap pl-0.5 font-display text-[9px] font-extrabold uppercase tracking-[0.12em] text-ink-muted"
            title={sec.label ?? SECTION_SHORT_LABEL[sec.key]}
          >
            {sidx + 1}. {sec.label ?? SECTION_SHORT_LABEL[sec.key]}
          </div>
          <div className="grid grid-cols-2 gap-[3px]">
            {[1, 2].map((r) => {
              const round = r as 1 | 2;
              const key = `${sec.key}_r${round}`;
              const isCurrent =
                current.sectionIdx === sidx && current.round === round;
              const isDone = completed[key] === true;
              return (
                <button
                  key={round}
                  type="button"
                  onClick={() => onJump?.(sidx, round)}
                  data-slot="stepper-cell"
                  data-section={sec.key}
                  data-round={round}
                  data-current={isCurrent}
                  data-done={isDone}
                  className={cn(
                    "flex h-9 items-center justify-center gap-1 rounded-md border-[1.5px] font-mono text-[11px] font-bold transition",
                    isDone
                      ? "border-primary-500 bg-primary-500 text-on-primary"
                      : isCurrent
                        ? "border-primary-500 bg-primary-500/8 text-primary-600 shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-primary-500)_18%,transparent)]"
                        : "border-border-strong bg-bone text-ink-muted hover:bg-surface-muted",
                  )}
                >
                  {isDone && <Check aria-hidden="true" className="size-3" />}
                  R{round}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
