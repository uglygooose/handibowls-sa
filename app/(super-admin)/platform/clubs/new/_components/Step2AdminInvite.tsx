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

import type { WizardFormValues } from "../_schema";

export function Step2AdminInvite() {
  const form = useFormContext<WizardFormValues>();

  return (
    <div data-testid="step-2-admin-invite" className="flex flex-col gap-4">
      <div className="max-w-xl">
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
                The primary club admin. They&apos;ll receive an invite link to
                set a password and start managing their club. Additional admins
                can be promoted from Step 4 or invited later from the club
                detail page.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <p className="text-sm text-ink-subtle">
        The invite is written only when you publish — nothing goes out if you
        abandon the wizard or save a draft.
      </p>
    </div>
  );
}
