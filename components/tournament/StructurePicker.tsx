"use client";

import { Check, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Database } from "@/types/database.types";

// 4-structure picker per HandiBowls Admin design.
// Knockout + drawn_social ship in v1; round_robin + sectional ship as
// engine skeletons (Phase 6c) and are rendered disabled here with a lock
// icon and "Coming in a later release" tooltip per the brief's locked
// engine constraints.

export type TournamentStructure =
  Database["public"]["Enums"]["tournament_structure"];

type Props = {
  value: TournamentStructure;
  onChange: (structure: TournamentStructure) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
};

type StructureSpec = {
  id: TournamentStructure;
  label: string;
  description: string;
  enabled: boolean;
};

const STRUCTURES: StructureSpec[] = [
  {
    id: "knockout",
    label: "Knockout",
    description: "Single-elimination bracket with BYEs and play-in support.",
    enabled: true,
  },
  {
    id: "drawn_social",
    label: "Drawn / Social",
    description: "No fixtures generated — drawn pairings on the day.",
    enabled: true,
  },
  {
    id: "round_robin",
    label: "Round Robin",
    description: "Every team plays every other team once.",
    enabled: false,
  },
  {
    id: "sectional",
    label: "Sectional",
    description: "Round-robin sections feed a knockout cutoff.",
    enabled: false,
  },
];

const DISABLED_TOOLTIP = "Coming in a later release";

export function StructurePicker({
  value,
  onChange,
  disabled,
  label,
  className,
}: Props) {
  return (
    <div data-slot="structure-picker" className={cn("flex flex-col gap-2", className)}>
      {label && (
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={label ?? "Tournament structure"}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4"
      >
        {STRUCTURES.map((s) => {
          const active = value === s.id && s.enabled;
          const isDisabled = disabled || !s.enabled;
          return (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-disabled={isDisabled}
              data-active={active}
              data-locked={!s.enabled}
              disabled={isDisabled}
              title={s.enabled ? undefined : DISABLED_TOOLTIP}
              onClick={() => s.enabled && onChange(s.id)}
              className={cn(
                "group relative flex flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors",
                "border-border bg-surface text-ink",
                s.enabled && !isDisabled && "hover:bg-surface-muted",
                active && "border-primary-500 bg-primary-100/40",
                isDisabled && "cursor-not-allowed opacity-55",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-2.5 top-2.5 inline-flex size-4 items-center justify-center rounded-full border",
                  !s.enabled
                    ? "border-ink-subtle bg-surface-muted text-ink-muted"
                    : active
                      ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
                      : "border-border bg-surface text-transparent",
                )}
              >
                {!s.enabled ? (
                  <Lock className="size-2.5" strokeWidth={2.5} />
                ) : (
                  <Check className="size-3" strokeWidth={3} />
                )}
              </span>
              <span className="font-display text-base font-bold leading-none">
                {s.label}
              </span>
              <span className="text-[12px] leading-tight text-ink-muted">
                {s.enabled ? s.description : DISABLED_TOOLTIP}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
