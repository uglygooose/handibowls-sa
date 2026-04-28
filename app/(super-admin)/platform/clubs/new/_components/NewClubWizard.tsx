"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient as createBrowserClient } from "@/lib/supabase/client";

import {
  DEV_INVITE_BANNER_KEY,
  DEV_INVITE_TTL_MS,
  isDevBannerEnabled,
  type DevInviteBannerPayload,
} from "@/lib/dev-banner";

import { createClub } from "../../_actions";
import type { DistrictRow } from "../../_data";
import { clearDraft, readDraft, writeDraft } from "../_draft";
import {
  isThemePreset,
  STEP_COUNT,
  STEP_TRIGGERS,
  WIZARD_DEFAULTS,
  wizardSchema,
  type WizardFormInput,
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

  // Three generics: TFieldValues = Input (pre-coerce/default), TContext, and
  // TTransformedValues = Output (what handleSubmit / explicit parse yields).
  // Resolver v5 correctly types these as distinct; see _schema.ts.
  const form = useForm<WizardFormInput, unknown, WizardFormValues>({
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

  // Draft dialog is rendered gated on this enum so Playwright / tests can
  // deterministically assert which branch fired on mount.
  //   "pending"  — still deciding (blocks auto-write)
  //   "prompt"   — draft found, show Resume/Discard
  //   "none"     — no draft, wizard live
  //   "resumed"  — user picked Resume; form was reset with draft
  const [draftState, setDraftState] = useState<
    "pending" | "prompt" | "none" | "resumed"
  >("pending");
  const [draftSnapshot, setDraftSnapshot] = useState<WizardFormInput | null>(
    null,
  );
  const debounceRef = useRef<number | null>(null);

  const currentStep = Math.min(urlStep, furthestStep);

  // If the URL asks for a step the user hasn't reached, silently rewrite it.
  useEffect(() => {
    if (urlStep > furthestStep) {
      router.replace(`?step=${furthestStep}`);
    }
  }, [urlStep, furthestStep, router]);

  // Mount: check sessionStorage for a saved draft. If present, pause the
  // wizard behind the Resume/Discard dialog; draft auto-write stays off
  // until the user resolves it to avoid overwriting their draft with the
  // default empty form.
  useEffect(() => {
    const snapshot = readDraft();
    if (snapshot) {
      setDraftSnapshot(snapshot);
      setDraftState("prompt");
    } else {
      setDraftState("none");
    }
  }, []);

  // Watch every form change; debounce 500ms then persist. Only active once
  // the user has resolved the draft prompt (or there was no draft).
  useEffect(() => {
    if (draftState !== "none" && draftState !== "resumed") return;
    const subscription = form.watch((values) => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
      debounceRef.current = window.setTimeout(() => {
        writeDraft(values as WizardFormInput);
      }, 500);
    });
    return () => {
      subscription.unsubscribe();
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [draftState, form]);

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
    writeDraft(form.getValues());
    toast.success("Draft saved. It will survive tab navigation until you publish.");
  }, [form]);

  const handleResumeDraft = useCallback(() => {
    if (!draftSnapshot) return;
    form.reset(draftSnapshot);
    setDraftState("resumed");
    setDraftSnapshot(null);
  }, [draftSnapshot, form]);

  const handleDiscardDraft = useCallback(() => {
    clearDraft();
    setDraftState("none");
    setDraftSnapshot(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setPublishError(null);
    const ok = await form.trigger();
    if (!ok) {
      toast.error("Fix the highlighted fields to continue.");
      return;
    }
    // `form.getValues()` returns the Input type (pre-coerce). Parse once via
    // the schema to get Output-typed data (rink_count: number, required
    // strings). `safeParse` is defensive — `trigger()` just ran, so this
    // should always succeed.
    const parsed = wizardSchema.safeParse(form.getValues());
    if (!parsed.success) {
      toast.error("Fix the highlighted fields to continue.");
      return;
    }
    const values = parsed.data;
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
      // so production never sees this path. See lib/dev-banner.ts.
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

      clearDraft();
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
        data-draft-state={draftState}
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
      <Dialog open={draftState === "prompt"}>
        <DialogContent data-testid="wizard-draft-dialog">
          <DialogHeader>
            <DialogTitle>Unfinished club draft</DialogTitle>
            <DialogDescription>
              We found a wizard draft from this tab session. Resume where you
              left off, or discard it to start fresh.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleDiscardDraft}
              data-testid="wizard-draft-discard"
            >
              Discard
            </Button>
            <Button
              type="button"
              onClick={handleResumeDraft}
              data-testid="wizard-draft-resume"
            >
              Resume draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </FormProvider>
  );
}
