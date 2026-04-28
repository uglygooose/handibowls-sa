"use client";

import { Check } from "lucide-react";
import { Fragment } from "react";

import { cn } from "@/lib/utils";

import { STEP_KEYS, STEP_LABELS } from "../_schema";

type Props = {
  currentStep: number;
  furthestStep: number;
  onJump: (step: number) => void;
};

// Wizard step indicator per the Claude Design treatment:
//   - circular numbered steps (36px) — active fills primary-500 with a
//     4px ring; done fills ink with a check icon; pending stays bone
//     with a border
//   - 10px mono uppercase label sits below each circle
//   - a 2px connecting line between circles fills ink as it's crossed
//   - already-reached circles remain clickable so the user can step
//     back; forward jumps are disallowed (preserves the gate semantics)
export function WizardProgress({ currentStep, furthestStep, onJump }: Props) {
  return (
    <ol
      aria-label="Wizard progress"
      data-testid="wizard-progress"
      className="my-6 flex items-start gap-0"
    >
      {STEP_KEYS.map((key, i) => {
        const step = i + 1;
        const isActive = step === currentStep;
        const isComplete = step < furthestStep;
        const isReachable = step <= furthestStep;
        const isLast = i === STEP_KEYS.length - 1;
        return (
          <Fragment key={key}>
            <li className="flex flex-col items-center gap-2">
              <button
                type="button"
                data-testid={`wizard-step-${step}`}
                data-active={isActive || undefined}
                data-complete={isComplete || undefined}
                disabled={!isReachable}
                onClick={() => onJump(step)}
                className={cn(
                  "inline-flex size-9 items-center justify-center rounded-full",
                  "border-2 font-display text-sm font-extrabold transition-all",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  isActive &&
                    "border-primary-500 bg-primary-500 text-on-primary shadow-[0_0_0_4px_rgba(215,38,30,0.15)]",
                  !isActive && isComplete && "border-ink bg-ink text-ink-inverse",
                  !isActive && !isComplete && "border-border bg-bone text-ink-subtle",
                )}
              >
                {isComplete ? <Check className="size-3.5" aria-hidden="true" /> : step}
              </button>
              <span
                className={cn(
                  "font-mono text-[10px] font-bold uppercase tracking-[0.12em]",
                  isActive ? "text-ink" : "text-ink-subtle",
                )}
              >
                {STEP_LABELS[key]}
              </span>
            </li>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 h-0.5 flex-1 self-start",
                  isComplete ? "bg-ink" : "bg-border",
                )}
                style={{ marginTop: 17 }}
              />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
