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
import { Input } from "@/components/ui/input";

import type { SetupFormInput, SetupFormValues } from "../_schema";

type Props = {
  // Email comes from auth.user — never editable here. Locked display only.
  email: string;
};

export function Step3Contact({ email }: Props) {
  const form = useFormContext<SetupFormInput, unknown, SetupFormValues>();

  return (
    <div data-testid="step-3-contact" className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Where the club reaches you for match fixtures and notices.
      </p>

      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input
            type="email"
            value={email}
            readOnly
            disabled
            data-testid="setup-email-locked"
          />
        </FormControl>
        <FormDescription>
          Locked to your sign-in email. Contact your club admin to change it.
        </FormDescription>
      </FormItem>

      <FormField
        control={form.control}
        name="contact.phone"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Phone (optional)</FormLabel>
            <FormControl>
              <Input
                type="tel"
                autoComplete="tel"
                placeholder="+27 82 123 4567"
                data-testid="setup-phone"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="contact.email_opt_in"
        render={({ field }) => (
          <FormItem className="flex flex-row items-start gap-3 rounded-md border border-border p-3">
            <FormControl>
              <Checkbox
                checked={field.value}
                onCheckedChange={(v) => field.onChange(v === true)}
                data-testid="setup-email-opt-in"
              />
            </FormControl>
            <div className="space-y-1 leading-tight">
              <FormLabel className="cursor-pointer">
                Send me club notices and tournament updates by email
              </FormLabel>
              <FormDescription>
                You can change this anytime in your profile settings.
              </FormDescription>
            </div>
          </FormItem>
        )}
      />
    </div>
  );
}
