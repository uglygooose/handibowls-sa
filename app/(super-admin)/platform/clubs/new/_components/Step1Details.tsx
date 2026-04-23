"use client";

import { X } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFormContext } from "react-hook-form";

import { BowlChip } from "@/components/brand/BowlChip";
import { ThemePreview } from "@/components/brand/ThemePreview";
import { THEME_PRESETS } from "@/components/brand/theme-presets";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

import type { DistrictRow } from "../../_data";
import { slugify, type WizardFormValues } from "../_schema";

type Props = {
  districts: DistrictRow[];
  logoFile: File | null;
  onLogoChange: (file: File | null) => void;
};

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml";

export function Step1Details({ districts, logoFile, onLogoChange }: Props) {
  const form = useFormContext<WizardFormValues>();
  const [slugTouched, setSlugTouched] = useState<boolean>(() =>
    Boolean(form.getValues("details.slug")),
  );
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const name = form.watch("details.name");

  useEffect(() => {
    if (!slugTouched) {
      const derived = slugify(name);
      form.setValue("details.slug", derived, { shouldValidate: false });
    }
  }, [name, slugTouched, form]);

  // Client-side preview URL — derived directly from the File; the effect
  // below is revocation-only so the URL string is never held in state.
  const logoPreview = useMemo(
    () => (logoFile ? URL.createObjectURL(logoFile) : null),
    [logoFile],
  );
  useEffect(() => {
    if (!logoPreview) return;
    return () => URL.revokeObjectURL(logoPreview);
  }, [logoPreview]);

  const handleLogoPick = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setLogoError(null);
      const file = event.target.files?.[0];
      if (!file) {
        onLogoChange(null);
        return;
      }
      if (file.size > LOGO_MAX_BYTES) {
        setLogoError("Logo must be 2 MB or smaller.");
        event.target.value = "";
        return;
      }
      if (!LOGO_ACCEPT.split(",").includes(file.type)) {
        setLogoError("Use PNG, JPEG, WebP, or SVG.");
        event.target.value = "";
        return;
      }
      onLogoChange(file);
    },
    [onLogoChange],
  );

  const clearLogo = useCallback(() => {
    onLogoChange(null);
    setLogoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [onLogoChange]);

  const previewName = useMemo(() => name.trim() || "Club name", [name]);
  const selectedPreset = form.watch("details.theme_preset");

  return (
    <div data-testid="step-1-details" className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="details.name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Club name</FormLabel>
              <FormControl>
                <Input
                  data-testid="field-name"
                  placeholder="Gauteng North Bowls Club"
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="details.short_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short name</FormLabel>
              <FormControl>
                <Input
                  data-testid="field-short-name"
                  placeholder="GNBC"
                  maxLength={20}
                  autoComplete="off"
                  {...field}
                />
              </FormControl>
              <FormDescription>Badge / scoreboard abbreviation.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="details.slug"
        render={({ field }) => (
          <FormItem>
            <FormLabel>URL slug</FormLabel>
            <FormControl>
              <Input
                data-testid="field-slug"
                placeholder="gauteng-north"
                autoComplete="off"
                {...field}
                onChange={(e) => {
                  setSlugTouched(true);
                  field.onChange(e);
                }}
              />
            </FormControl>
            <FormDescription>
              Auto-generated from the club name. Edit to override — lowercase
              letters, digits, and hyphens only.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="details.district_id"
          render={({ field }) => (
            <FormItem>
              <FormLabel>District</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger data-testid="field-district">
                    <SelectValue placeholder="Select a district" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {districts.map((d) => (
                    <SelectItem key={d.id} value={d.id} data-testid={`district-${d.id}`}>
                      {d.name}
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
          name="details.city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>City</FormLabel>
              <FormControl>
                <Input
                  data-testid="field-city"
                  placeholder="Pretoria"
                  autoComplete="address-level2"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <FormField
          control={form.control}
          name="details.contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Contact email <span className="text-ink-subtle">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input
                  data-testid="field-contact-email"
                  type="email"
                  placeholder="secretary@club.co.za"
                  autoComplete="email"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="details.contact_phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Contact phone <span className="text-ink-subtle">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input
                  data-testid="field-contact-phone"
                  type="tel"
                  placeholder="+27 12 345 6789"
                  autoComplete="tel"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <FormLabel>
          Logo <span className="text-ink-subtle">(optional)</span>
        </FormLabel>
        <div className="flex items-start gap-4">
          {logoPreview ? (
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl ring-1 ring-border">
              <Image
                src={logoPreview}
                alt="Logo preview"
                fill
                sizes="80px"
                className="object-cover"
                data-testid="logo-preview"
                unoptimized
              />
            </div>
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-muted text-xs text-muted-foreground ring-1 ring-border">
              No logo
            </div>
          )}
          <div className="flex flex-col gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={LOGO_ACCEPT}
              onChange={handleLogoPick}
              data-testid="field-logo"
              className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-foreground file:px-3 file:py-1.5 file:text-background hover:file:bg-foreground/90"
            />
            <p className="text-xs text-ink-subtle">
              PNG, JPEG, WebP, or SVG · up to 2 MB.
            </p>
            {logoFile && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearLogo}
                data-testid="logo-clear"
                className="h-7 self-start px-2"
              >
                <X className="mr-1 h-3 w-3" />
                Remove
              </Button>
            )}
            {logoError && (
              <p className="text-sm text-destructive" data-testid="logo-error">
                {logoError}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FormField
          control={form.control}
          name="details.theme_preset"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Theme preset</FormLabel>
              <FormControl>
                <ul
                  role="radiogroup"
                  aria-label="Club theme preset"
                  className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5"
                  data-testid="theme-presets"
                >
                  {THEME_PRESETS.map((preset) => {
                    const isSelected = field.value === preset;
                    return (
                      <li key={preset}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          data-testid={`theme-preset-${preset}`}
                          onClick={() => field.onChange(preset)}
                          className={cn(
                            "flex w-full flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                            "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            isSelected
                              ? "border-foreground bg-muted/60"
                              : "border-border hover:bg-muted/30",
                          )}
                        >
                          <BowlChip preset={preset} size={40} selected={isSelected} />
                          <span className="text-xs font-medium leading-tight">
                            {preset.replace(/-/g, " ")}
                          </span>
                          {isSelected && (
                            <Badge variant="outline" className="text-[10px]">
                              Selected
                            </Badge>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex flex-col gap-2">
          <FormLabel>Live preview</FormLabel>
          {selectedPreset ? (
            <ThemePreview
              preset={selectedPreset as (typeof THEME_PRESETS)[number]}
              label={previewName}
              data-testid="theme-preview-live"
            />
          ) : (
            <div
              className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border text-sm text-muted-foreground"
              data-testid="theme-preview-empty"
            >
              Pick a preset to preview.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
