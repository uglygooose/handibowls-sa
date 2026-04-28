"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type Props<TKey extends string> = {
  steps: readonly TKey[];
  labels: Record<TKey, string>;
  currentStep: number;
  furthestStep: number;
  onJump: (step: number) => void;
};

// Generic multi-step progress bar. Clicking an already-reached step jumps
// back; forward jumps are disallowed (the caller advances furthestStep when
// the user passes each gate). The currently-active step is accented;
// completed steps render with a checkmark.
export function WizardProgress<TKey extends string>({
  steps,
  labels,
  currentStep,
  furthestStep,
  onJump,
}: Props<TKey>) {
  const total = steps.length;
  return (
    <ol
      aria-label="Wizard progress"
      data-testid="wizard-progress"
      className="flex flex-wrap items-center gap-x-2 gap-y-3 text-sm"
    >
      {steps.map((key, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isComplete = step < furthestStep;
        const isReachable = step <= furthestStep;
        return (
          <li key={key} className="flex items-center gap-2">
            <button
              type="button"
              data-testid={`wizard-step-${step}`}
              data-active={isActive || undefined}
              data-complete={isComplete || undefined}
              disabled={!isReachable}
              onClick={() => onJump(step)}
              className={cn(
                "flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase transition-colors",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isActive && "border-foreground bg-foreground text-background",
                !isActive && isComplete && "border-border bg-muted",
                !isActive && !isComplete && "border-border",
              )}
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  isActive
                    ? "bg-background text-foreground"
                    : isComplete
                      ? "bg-foreground text-background"
                      : "bg-muted text-foreground",
                )}
                aria-hidden="true"
              >
                {isComplete ? <Check className="h-3 w-3" /> : step}
              </span>
              {labels[key]}
            </button>
            {step < total && (
              <span
                aria-hidden="true"
                className={cn(
                  "hidden h-px w-6 sm:block",
                  step < furthestStep ? "bg-foreground" : "bg-border",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
