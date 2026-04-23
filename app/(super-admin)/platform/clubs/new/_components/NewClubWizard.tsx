"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";

import type { DistrictRow } from "../../_data";
import {
  STEP_COUNT,
  STEP_TRIGGERS,
  WIZARD_DEFAULTS,
  wizardSchema,
  type WizardFormValues,
} from "../_schema";
import { Step1Details } from "./Step1Details";
import { Step2AdminInvite } from "./Step2AdminInvite";
import { Step3Greens } from "./Step3Greens";
import { Step4Players } from "./Step4Players";
import { Step5Review } from "./Step5Review";
import { WizardNav } from "./WizardNav";
import { WizardProgress } from "./WizardProgress";

type Props = {
  districts: DistrictRow[];
};

function clampStep(raw: string | null): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  if (n > STEP_COUNT) return STEP_COUNT;
  return n;
}

export function NewClubWizard({ districts }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlStep = clampStep(searchParams.get("step"));

  const form = useForm<WizardFormValues>({
    resolver: zodResolver(wizardSchema),
    defaultValues: WIZARD_DEFAULTS,
    mode: "onChange",
  });

  // The highest step the user has successfully passed the gate for. URL
  // step > furthestStep silently bounces to step 1 on mount — deep-linking
  // past a gate renders a partial review and confuses users (directive 4).
  const [furthestStep, setFurthestStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStep = Math.min(urlStep, furthestStep);

  // If the URL asks for a step the user hasn't reached, silently rewrite it.
  useEffect(() => {
    if (urlStep > furthestStep) {
      router.replace(`?step=${furthestStep}`);
    }
  }, [urlStep, furthestStep, router]);

  const goToStep = useCallback(
    (step: number) => {
      router.replace(`?step=${step}`);
    },
    [router],
  );

  const handleBack = useCallback(() => {
    if (currentStep > 1) goToStep(currentStep - 1);
  }, [currentStep, goToStep]);

  const handleNext = useCallback(async () => {
    const triggers = STEP_TRIGGERS[currentStep];
    const ok = triggers ? await form.trigger(triggers) : await form.trigger();
    if (!ok) {
      toast.error("Fix the highlighted fields to continue.");
      return;
    }
    const nextStep = Math.min(currentStep + 1, STEP_COUNT);
    setFurthestStep((f) => Math.max(f, nextStep));
    goToStep(nextStep);
  }, [currentStep, form, goToStep]);

  const handleJump = useCallback(
    (step: number) => {
      if (step <= furthestStep) goToStep(step);
    },
    [furthestStep, goToStep],
  );

  const handleSaveDraft = useCallback(() => {
    // Draft persistence wiring lands in a later commit (sessionStorage key
    // `handibowls:new-club-wizard-draft`). Stub preserves the UI surface so
    // Playwright can exercise it end-to-end.
    toast.info("Draft saving lands with the sessionStorage commit.");
  }, []);

  const handleSubmit = useCallback(async () => {
    const ok = await form.trigger();
    if (!ok) {
      toast.error("Fix the highlighted fields to continue.");
      return;
    }
    setIsSubmitting(true);
    try {
      // Publish wiring lands with the review/publish commit. Guardrailing
      // the button here so a stub click doesn't look broken.
      toast.info("Publish lands with the review-and-publish commit.");
    } finally {
      setIsSubmitting(false);
    }
  }, [form]);

  const currentContent = useMemo(() => {
    switch (currentStep) {
      case 1:
        return <Step1Details districts={districts} />;
      case 2:
        return <Step2AdminInvite />;
      case 3:
        return <Step3Greens />;
      case 4:
        return <Step4Players />;
      case 5:
        return <Step5Review districts={districts} />;
      default:
        return null;
    }
  }, [currentStep, districts]);

  return (
    <FormProvider {...form}>
      <form
        data-testid="new-club-wizard"
        data-current-step={currentStep}
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-6"
      >
        <WizardProgress
          currentStep={currentStep}
          furthestStep={furthestStep}
          onJump={handleJump}
        />
        <Card>
          <CardContent className="pt-6">{currentContent}</CardContent>
        </Card>
        <WizardNav
          currentStep={currentStep}
          totalSteps={STEP_COUNT}
          isSubmitting={isSubmitting}
          onBack={handleBack}
          onNext={handleNext}
          onSaveDraft={handleSaveDraft}
          onSubmit={handleSubmit}
        />
      </form>
    </FormProvider>
  );
}
