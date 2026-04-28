"use client";

import { ArrowLeft, ArrowRight, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  onBack: () => void;
  onNext: () => void;
  onSaveDraft: () => void;
  onSubmit: () => void;
  // Final step's primary action label. Step 4 (initial players) flips this
  // to "Skip this step" via the wizard's hidden skip button — when null, no
  // optional skip control renders.
  onSkip?: () => void;
};

// Footer button row per the Claude Design treatment. Sticky at the bottom
// of the wizard form, separated from the content by a top border. Cancel
// lives on the left as a ghost button; Save-draft + Continue/Publish on
// the right; an inline "Skip this step" link surfaces on Step 4 only.
export function WizardNav({
  currentStep,
  totalSteps,
  isSubmitting,
  onBack,
  onNext,
  onSaveDraft,
  onSubmit,
  onSkip,
}: Props) {
  const isFinal = currentStep === totalSteps;
  return (
    <div
      data-testid="wizard-nav"
      className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6"
    >
      {currentStep > 1 ? (
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          data-testid="wizard-back"
          className="gap-1.5"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back
        </Button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2.5">
        {onSkip && !isFinal && (
          <button
            type="button"
            onClick={onSkip}
            disabled={isSubmitting}
            data-testid="wizard-skip"
            className="bg-transparent text-[13px] text-ink-subtle underline underline-offset-[3px] hover:text-ink disabled:opacity-50"
          >
            Skip this step
          </button>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={onSaveDraft}
          disabled={isSubmitting}
          data-testid="wizard-save-draft"
        >
          Save draft
        </Button>
        {isFinal ? (
          <Button
            type="button"
            size="xl"
            onClick={onSubmit}
            disabled={isSubmitting}
            data-testid="wizard-submit"
            className="gap-1.5"
          >
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {isSubmitting ? "Publishing…" : "Publish club"}
          </Button>
        ) : (
          <Button
            type="button"
            size="xl"
            onClick={onNext}
            disabled={isSubmitting}
            data-testid="wizard-next"
            className="gap-1.5"
          >
            Continue
            <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}
