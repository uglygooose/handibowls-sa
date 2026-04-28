"use client";

import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  // Optional draft-save action. When omitted, the Save-draft button is
  // hidden — appropriate for one-shot wizards (e.g. /me/setup) that don't
  // persist intermediate state.
  onSaveDraft?: () => void;
  nextLabel?: string;
  submitLabel?: string;
  submittingLabel?: string;
};

// Generic footer button row. Back is disabled on step 1; on the final step
// the primary CTA switches to the caller-specific submit handler with
// caller-specific labels.
export function WizardNav({
  currentStep,
  totalSteps,
  isSubmitting,
  onBack,
  onNext,
  onSubmit,
  onSaveDraft,
  nextLabel,
  submitLabel = "Submit",
  submittingLabel = "Submitting…",
}: Props) {
  const isFinal = currentStep === totalSteps;
  return (
    <div
      data-testid="wizard-nav"
      className="sticky bottom-0 z-10 -mx-6 mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-6 py-4 backdrop-blur"
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={currentStep === 1 || isSubmitting}
        data-testid="wizard-back"
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        Back
      </Button>
      <div className="flex items-center gap-2">
        {onSaveDraft && (
          <Button
            type="button"
            variant="outline"
            onClick={onSaveDraft}
            disabled={isSubmitting}
            data-testid="wizard-save-draft"
          >
            Save draft
          </Button>
        )}
        {isFinal ? (
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            data-testid="wizard-submit"
          >
            {isSubmitting && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            {isSubmitting ? submittingLabel : submitLabel}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onNext}
            disabled={isSubmitting}
            data-testid="wizard-next"
          >
            {nextLabel ?? "Next"}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
