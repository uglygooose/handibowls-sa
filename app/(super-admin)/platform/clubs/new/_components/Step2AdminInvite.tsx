"use client";

import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import type { WizardFormInput, WizardFormValues } from "../_schema";

export function Step2AdminInvite() {
  const form = useFormContext<WizardFormInput, unknown, WizardFormValues>();

  return (
    <div data-testid="step-2-admin-invite" className="flex max-w-xl flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Who runs this club? We&apos;ll send them an invite to set up their
        account.
      </p>
      <FormField
        control={form.control}
        name="adminInvite.admin_email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Club-admin email</FormLabel>
            <FormControl>
              <Input
                data-testid="field-admin-email"
                type="email"
                placeholder="admin@club.co.za"
                autoComplete="email"
                {...field}
              />
            </FormControl>
            <FormDescription>
              Additional admins can be promoted from Step 4 or invited later
              from the club detail page.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {/* Helper card per design — left-bordered hint with role context. */}
      <div className="rounded-[10px] border border-border border-l-[3px] border-l-primary-500 bg-surface px-4 py-3.5 text-[13px] text-ink-muted">
        <strong className="text-ink">About the club admin role.</strong> The
        club admin can invite players, configure greens, and run tournaments.
        They&apos;ll receive an email at the address above with a setup link
        valid for 14 days. The invite is only written when you publish —
        nothing goes out if you abandon the wizard or save a draft.
      </div>
    </div>
  );
}
