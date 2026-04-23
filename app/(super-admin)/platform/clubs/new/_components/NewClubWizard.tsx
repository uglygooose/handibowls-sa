"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

import { createClub } from "../../_actions";
import type { DistrictRow } from "../../_data";
import {
  DEV_INVITE_BANNER_KEY,
  DEV_INVITE_TTL_MS,
  isDevBannerEnabled,
  type DevInviteBannerPayload,
} from "../_dev-banner";
import {
  isThemePreset,
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
  const [publishError, setPublishError] = useState<string | null>(null);
  // Logo file is held in component state — not in form values, not in
  // sessionStorage. Survives step navigation but dies on page refresh by
  // design (binary-file draft restore is not worth the complexity).
  const [logoFile, setLogoFile] = useState<File | null>(null);

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
    setPublishError(null);
    const ok = await form.trigger();
    if (!ok) {
      toast.error("Fix the highlighted fields to continue.");
      return;
    }
    const values = form.getValues();
    if (!isThemePreset(values.details.theme_preset)) {
      setPublishError("Pick a theme preset on Step 1 before publishing.");
      return;
    }
    setIsSubmitting(true);
    try {
      let logoPath = "";
      if (logoFile) {
        const supabase = createBrowserClient();
        const ext = logoFile.name.split(".").pop() ?? "bin";
        const path = `pending/${crypto.randomUUID()}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("club-logos")
          .upload(path, logoFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: logoFile.type || undefined,
          });
        if (uploadError) {
          setPublishError(`Logo upload failed: ${uploadError.message}`);
          return;
        }
        logoPath = path;
      }

      const result = await createClub({
        name: values.details.name,
        short_name: values.details.short_name || null,
        slug: values.details.slug,
        district_id: values.details.district_id,
        city: values.details.city,
        contact_email: values.details.contact_email || null,
        contact_phone: values.details.contact_phone || null,
        logo_path: logoPath || null,
        theme_preset: values.details.theme_preset,
        admin_email: values.adminInvite.admin_email,
        greens: values.greens.greens,
        player_emails: values.players.players.map((p) => p.email),
      });

      if (!result.ok) {
        setPublishError(result.error);
        return;
      }

      // Dev-only: stash the admin invite token so the freshly-loaded club
      // detail page can render a copy-link banner. Gated on both env flags
      // so production never sees this path. See _dev-banner.ts.
      if (isDevBannerEnabled() && result.data.admin_invite_token) {
        try {
          const payload: DevInviteBannerPayload = {
            clubId: result.data.club_id,
            inviteToken: result.data.admin_invite_token,
            expiresAt: Date.now() + DEV_INVITE_TTL_MS,
          };
          window.sessionStorage.setItem(
            DEV_INVITE_BANNER_KEY,
            JSON.stringify(payload),
          );
        } catch {
          // Non-fatal — banner is dev-only and best-effort.
        }
      }

      router.push(`/platform/clubs/${result.data.club_id}`);
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : "Unexpected error while publishing.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [form, logoFile, router]);

  const currentContent = useMemo(() => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Details
            districts={districts}
            logoFile={logoFile}
            onLogoChange={setLogoFile}
          />
        );
      case 2:
        return <Step2AdminInvite />;
      case 3:
        return <Step3Greens />;
      case 4:
        return <Step4Players />;
      case 5:
        return (
          <Step5Review
            districts={districts}
            logoFile={logoFile}
            publishError={publishError}
            onJumpTo={handleJump}
          />
        );
      default:
        return null;
    }
  }, [currentStep, districts, handleJump, logoFile, publishError]);

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
