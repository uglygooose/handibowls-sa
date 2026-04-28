"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { WizardNav } from "@/components/wizard/WizardNav";
import { WizardProgress } from "@/components/wizard/WizardProgress";

import { completePlayerProfile } from "../_actions";
import {
  defaultsForProfile,
  setupSchema,
  STEP_COUNT,
  STEP_KEYS,
  STEP_LABELS,
  STEP_TRIGGERS,
  type ProfilePrefill,
  type SetupFormInput,
  type SetupFormValues,
} from "../_schema";
import { Step1Identity } from "./Step1Identity";
import { Step2Bowls } from "./Step2Bowls";
import { Step3Contact } from "./Step3Contact";
import { Step4Consent } from "./Step4Consent";

type Props = {
  prefill: ProfilePrefill;
  email: string;
};

export function SetupWizard({ prefill, email }: Props) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [furthestStep, setFurthestStep] = useState(1);
  const [isSubmitting, startSubmit] = useTransition();

  const form = useForm<SetupFormInput, unknown, SetupFormValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: defaultsForProfile(prefill),
    mode: "onBlur",
  });

  const handleNext = async () => {
    const trigger = STEP_TRIGGERS[currentStep];
    const ok = await form.trigger(trigger);
    if (!ok) return;
    const next = Math.min(currentStep + 1, STEP_COUNT);
    setCurrentStep(next);
    setFurthestStep((f) => Math.max(f, next));
  };

  const handleBack = () => setCurrentStep((s) => Math.max(1, s - 1));

  const handleJump = (step: number) => {
    if (step <= furthestStep) setCurrentStep(step);
  };

  const handleSubmit = () => {
    startSubmit(async () => {
      try {
        const ok = await form.trigger();
        if (!ok) {
          toast.error("Please fix the errors before submitting.");
          return;
        }
        const values = form.getValues() as unknown as SetupFormValues;
        const result = await completePlayerProfile(values);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success("Profile complete — welcome to HandiBowls.");
        // The (player)/(gated) layout's gate now sees profile_completed=true
        // and lets the user through without bouncing back to /me/setup.
        router.replace("/play");
        router.refresh();
      } catch (err) {
        // Server actions throwing should never silently hang the transition;
        // surface the error so the player isn't stuck on "Saving…".
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Setup failed: ${msg}`);
      }
    });
  };

  const stepContent =
    currentStep === 1 ? <Step1Identity /> :
    currentStep === 2 ? <Step2Bowls /> :
    currentStep === 3 ? <Step3Contact email={email} /> :
    <Step4Consent />;

  return (
    <FormProvider {...form}>
      <form
        data-testid="setup-wizard"
        data-current-step={currentStep}
        onSubmit={(e) => e.preventDefault()}
        className="flex flex-col gap-6"
      >
        <WizardProgress
          steps={STEP_KEYS}
          labels={STEP_LABELS}
          currentStep={currentStep}
          furthestStep={furthestStep}
          onJump={handleJump}
        />
        <Card>
          <CardContent className="pt-6">{stepContent}</CardContent>
        </Card>
        <WizardNav
          currentStep={currentStep}
          totalSteps={STEP_COUNT}
          isSubmitting={isSubmitting}
          onBack={handleBack}
          onNext={handleNext}
          onSubmit={handleSubmit}
          submitLabel="Finish setup"
          submittingLabel="Saving…"
        />
      </form>
    </FormProvider>
  );
}
