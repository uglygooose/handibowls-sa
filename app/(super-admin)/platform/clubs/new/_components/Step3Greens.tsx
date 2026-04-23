"use client";

import { Plus, Trash2 } from "lucide-react";
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

import type { WizardFormValues } from "../_schema";

const MAX_GREENS = 10;

export function Step3Greens() {
  const form = useFormContext<WizardFormValues>();
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
      <p className="text-sm text-muted-foreground">
        At least one green is required. Each green has 1–12 rinks (the standard
        club layout is 6).
      </p>

      <ul className="flex flex-col gap-3" data-testid="greens-list">
        {fields.map((field, index) => (
          <li
            key={field.id}
            data-testid={`green-row-${index}`}
            className="grid grid-cols-[1fr_120px_auto] gap-3 items-start"
          >
            <FormField
              control={form.control}
              name={`greens.greens.${index}.name`}
              render={({ field: nameField }) => (
                <FormItem>
                  <FormLabel className={index > 0 ? "sr-only" : undefined}>
                    Green name
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid={`green-${index}-name`}
                      placeholder={`Green ${index + 1}`}
                      autoComplete="off"
                      {...nameField}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`greens.greens.${index}.rink_count`}
              render={({ field: rinkField }) => (
                <FormItem>
                  <FormLabel className={index > 0 ? "sr-only" : undefined}>
                    Rinks
                  </FormLabel>
                  <FormControl>
                    <Input
                      data-testid={`green-${index}-rinks`}
                      type="number"
                      min={1}
                      max={12}
                      step={1}
                      inputMode="numeric"
                      {...rinkField}
                      onChange={(e) =>
                        rinkField.onChange(
                          e.target.value === "" ? "" : Number(e.target.value),
                        )
                      }
                      value={
                        rinkField.value === undefined || rinkField.value === null
                          ? ""
                          : rinkField.value
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className={index > 0 ? undefined : "pt-7"}>
              <Button
                type="button"
                variant="ghost"
                size="icon-md"
                aria-label={`Remove green ${index + 1}`}
                disabled={!canRemove}
                onClick={() => remove(index)}
                data-testid={`green-${index}-remove`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <div>
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
          <span className="ml-3 text-xs text-ink-subtle">
            Maximum of {MAX_GREENS} greens per club.
          </span>
        )}
      </div>
    </div>
  );
}
