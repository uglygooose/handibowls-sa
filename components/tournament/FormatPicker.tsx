"use client";

import { Check } from "lucide-react";

import { FORMAT_DEFAULTS, type TournamentFormat } from "@/lib/tournaments/formats";
import { cn } from "@/lib/utils";

// 5-format picker per HandiBowls Admin design.
// Layout: 5-column grid (auto-fit minmax 150px) with checkmark + label + meta.
// All 5 formats selectable — Triples is first-class (BSA Q9 lock).

type Props = {
  value: TournamentFormat;
  onChange: (format: TournamentFormat) => void;
  /** Disable interaction (e.g. while submitting). */
  disabled?: boolean;
  /** ARIA group label rendered above the buttons. */
  label?: string;
  className?: string;
};

const FORMAT_LABELS: Record<TournamentFormat, string> = {
  singles: "Singles",
  pairs: "Pairs",
  triples: "Triples",
  fours: "Fours",
  mixed_pairs: "Mixed Pairs",
};

function formatMeta(f: TournamentFormat): string {
  const d = FORMAT_DEFAULTS[f];
  if (d.scoringModel === "shots_up") {
    return `${d.bowlsPerPlayer} bowls · ${d.shotsTarget} up`;
  }
  return `${d.bowlsPerPlayer} bowls · ${d.endsTarget} ends`;
}

const FORMATS: TournamentFormat[] = [
  "singles",
  "pairs",
  "triples",
  "fours",
  "mixed_pairs",
];

export function FormatPicker({
  value,
  onChange,
  disabled,
  label,
  className,
}: Props) {
  return (
    <div data-slot="format-picker" className={cn("flex flex-col gap-2", className)}>
      {label && (
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-label={label ?? "Tournament format"}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"
      >
        {FORMATS.map((f) => {
          const active = value === f;
          return (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={active}
              data-active={active}
              disabled={disabled}
              onClick={() => onChange(f)}
              className={cn(
                "group relative flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors",
                "border-border bg-surface text-ink hover:bg-surface-muted",
                active && "border-primary-500 bg-primary-100/40",
                disabled && "cursor-not-allowed opacity-50",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "absolute right-2 top-2 inline-flex size-4 items-center justify-center rounded-full border",
                  active
                    ? "border-primary-500 bg-primary-500 text-[color:var(--color-on-primary)]"
                    : "border-border bg-surface text-transparent",
                )}
              >
                <Check className="size-3" strokeWidth={3} />
              </span>
              <span className="font-display text-base font-bold leading-none">
                {FORMAT_LABELS[f]}
              </span>
              <span className="font-mono text-[11px] text-ink-muted">
                {formatMeta(f)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
