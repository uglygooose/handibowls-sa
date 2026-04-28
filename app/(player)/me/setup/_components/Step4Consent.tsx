"use client";

import { useFormContext } from "react-hook-form";

import { Checkbox } from "@/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  MARKETING_VERSION,
  PRIVACY_VERSION,
  TERMS_VERSION,
} from "@/lib/legal/versions";

import type { SetupFormInput, SetupFormValues } from "../_schema";

export function Step4Consent() {
  const form = useFormContext<SetupFormInput, unknown, SetupFormValues>();

  return (
    <div data-testid="step-4-consent" className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Both required to finish setup. The marketing choice you set on the
        previous step is recorded against version {MARKETING_VERSION} for
        POPIA audit.
      </p>

      <FormField
        control={form.control}
        name="consent.agree_terms"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start gap-3 rounded-md border border-border p-3">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                data-testid="setup-agree-terms"
              />
            </FormControl>
            <div className="space-y-1 leading-tight">
              <FormLabel className="cursor-pointer">
                I agree to the HandiBowls Terms &amp; Conditions (v{TERMS_VERSION}).
              </FormLabel>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="consent.agree_privacy"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start gap-3 rounded-md border border-border p-3">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                data-testid="setup-agree-privacy"
              />
            </FormControl>
            <div className="space-y-1 leading-tight">
              <FormLabel className="cursor-pointer">
                I&apos;ve read the HandiBowls Privacy Policy (v{PRIVACY_VERSION}).
              </FormLabel>
              <FormDescription>
                We store data per POPIA — see your profile for export &amp; delete tools (Phase 11).
              </FormDescription>
              <FormMessage />
            </div>
          </FormItem>
        )}
      />
    </div>
  );
}
