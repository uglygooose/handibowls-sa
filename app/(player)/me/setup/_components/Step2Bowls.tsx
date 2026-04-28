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

// BSA position labels match the canonical terminology (skill: bsa-terminology).
const POSITION_OPTIONS: { value: "skip" | "third" | "second" | "lead"; label: string }[] = [
  { value: "skip", label: "Skip" },
  { value: "third", label: "Third" },
  { value: "second", label: "Second" },
  { value: "lead", label: "Lead" },
];

const HAND_OPTIONS: { value: "right" | "left"; label: string }[] = [
  { value: "right", label: "Right" },
  { value: "left", label: "Left" },
];

export function Step2Bowls() {
  const form = useFormContext<SetupFormInput, unknown, SetupFormValues>();

  return (
    <div data-testid="step-2-bowls" className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Your usual position and hand. The club admin can change your grading
        later if you swap roles.
      </p>

      <FormField
        control={form.control}
        name="bowls.bsa_number"
        render={({ field }) => (
          <FormItem>
            <FormLabel>BSA # (optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g. BS-12345"
                autoComplete="off"
                data-testid="setup-bsa-number"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormDescription>
              Your Bowls South Africa membership number, if you have one.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="bowls.club_grading"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Club grading</FormLabel>
              <Select value={field.value || ""} onValueChange={(v) => field.onChange(v)}>
                <FormControl>
                  <SelectTrigger data-testid="setup-club-grading">
                    <SelectValue placeholder="Pick a position" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {POSITION_OPTIONS.map((o) => (
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
          name="bowls.dominant_hand"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dominant hand</FormLabel>
              <Select value={field.value || ""} onValueChange={(v) => field.onChange(v)}>
                <FormControl>
                  <SelectTrigger data-testid="setup-dominant-hand">
                    <SelectValue placeholder="Pick one" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {HAND_OPTIONS.map((o) => (
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
      </div>
    </div>
  );
}
