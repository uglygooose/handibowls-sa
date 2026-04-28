"use client";

import { Plus, X } from "lucide-react";
import { useFieldArray, useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import type { WizardFormInput, WizardFormValues } from "../_schema";

const MAX_GREENS = 10;
const MIN_RINKS = 1;
const MAX_RINKS = 12;

// Repeating vertical lines per the design's green-card backing — visualises
// the rinks within a green at low opacity so the card reads as the playing
// surface itself.
const LANE_STRIPES =
  "repeating-linear-gradient(90deg, transparent 0, transparent 28px, var(--color-ink) 28px, var(--color-ink) 30px)";

export function Step3Greens() {
  const form = useFormContext<WizardFormInput, unknown, WizardFormValues>();
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "greens.greens",
  });

  const canRemove = fields.length > 1;
  const canAdd = fields.length < MAX_GREENS;

  const handleAdd = () => {
    append({ name: `Green ${fields.length + 1}`, rink_count: 6 });
  };

  return (
    <div data-testid="step-3-greens" className="flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Add the greens at this club. Each green is divided into rinks — the
        standard club layout is six rinks per green.
      </p>

      <ul className="flex flex-col gap-3.5" data-testid="greens-list">
        {fields.map((field, index) => (
          <li
            key={field.id}
            data-testid={`green-row-${index}`}
            className="relative overflow-hidden rounded-[14px] border-[1.5px] border-border bg-bone p-5"
          >
            {/* Lane-stripe backing — faint vertical lines at 4% opacity. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-[0.04]"
              style={{ background: LANE_STRIPES }}
            />
            <div className="relative">
              <div className="mb-3.5 flex items-start justify-between gap-3">
                <FormField
                  control={form.control}
                  name={`greens.greens.${index}.name`}
                  render={({ field: nameField }) => (
                    <FormItem className="flex-1">
                      <FormLabel className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                        Green name
                      </FormLabel>
                      <FormControl>
                        <Input
                          data-testid={`green-${index}-name`}
                          placeholder={`Green ${index + 1}`}
                          autoComplete="off"
                          className="max-w-[280px]"
                          {...nameField}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <button
                  type="button"
                  aria-label={`Remove green ${index + 1}`}
                  disabled={!canRemove}
                  onClick={() => remove(index)}
                  data-testid={`green-${index}-remove`}
                  className="inline-flex size-7 items-center justify-center rounded-md border border-border bg-bone text-ink-muted transition-colors hover:border-danger-500 hover:text-danger-500 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
              <FormField
                control={form.control}
                name={`greens.greens.${index}.rink_count`}
                render={({ field: rinkField }) => {
                  const value =
                    typeof rinkField.value === "number"
                      ? rinkField.value
                      : Number(rinkField.value) || MIN_RINKS;
                  const decrement = () =>
                    rinkField.onChange(Math.max(MIN_RINKS, value - 1));
                  const increment = () =>
                    rinkField.onChange(Math.min(MAX_RINKS, value + 1));
                  return (
                    <FormItem>
                      <FormLabel className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">
                        Rinks
                      </FormLabel>
                      <div className="text-[11px] italic text-ink-subtle mb-1">
                        Most clubs have 6 rinks per green.
                      </div>
                      <FormControl>
                        {/* Stepper per design: -/+ buttons flanking a
                            read-only display of the current count. */}
                        <div className="inline-flex items-center overflow-hidden rounded-md border border-border">
                          <button
                            type="button"
                            onClick={decrement}
                            disabled={value <= MIN_RINKS}
                            aria-label="Decrement rinks"
                            data-testid={`green-${index}-rinks-decrement`}
                            className="size-8 bg-bone text-base text-ink hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            −
                          </button>
                          <input
                            value={value}
                            readOnly
                            data-testid={`green-${index}-rinks`}
                            aria-label="Rinks"
                            className="size-12 w-12 border-x border-border bg-transparent text-center font-mono text-sm font-bold focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={increment}
                            disabled={value >= MAX_RINKS}
                            aria-label="Increment rinks"
                            data-testid={`green-${index}-rinks-increment`}
                            className="size-8 bg-bone text-base text-ink hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            +
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />
            </div>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={handleAdd}
          disabled={!canAdd}
          data-testid="greens-add"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add green
        </Button>
        {!canAdd && (
          <span className="text-xs text-ink-subtle">
            Maximum of {MAX_GREENS} greens per club.
          </span>
        )}
      </div>
    </div>
  );
}
