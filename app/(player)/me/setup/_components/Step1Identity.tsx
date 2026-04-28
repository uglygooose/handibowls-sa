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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { SetupFormInput, SetupFormValues } from "../_schema";

const GENDER_OPTIONS: { value: "male" | "female" | "other" | "prefer_not"; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
  { value: "prefer_not", label: "Prefer not to say" },
];

export function Step1Identity() {
  const form = useFormContext<SetupFormInput, unknown, SetupFormValues>();

  return (
    <div data-testid="step-1-identity" className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Confirm or correct what your club admin entered. We&apos;ll use this on
        scorecards and the leaderboard.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="identity.first_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>First name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="given-name"
                  data-testid="setup-first-name"
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
          name="identity.last_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Last name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="family-name"
                  data-testid="setup-last-name"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="identity.display_name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Display name (optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="Defaults to first + last"
                data-testid="setup-display-name"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormDescription>
              Shown on public-facing surfaces. Leave blank to use your full name.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="identity.gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gender</FormLabel>
              <Select
                value={field.value || ""}
                onValueChange={(v) => field.onChange(v)}
              >
                <FormControl>
                  <SelectTrigger data-testid="setup-gender">
                    <SelectValue placeholder="Pick one" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {GENDER_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="identity.date_of_birth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date of birth</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  autoComplete="bday"
                  data-testid="setup-dob"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
