"use client";

import { AlertTriangle, ChevronRight, Mail } from "lucide-react";
import type { ReactNode } from "react";
import { useFormContext } from "react-hook-form";

import { Bowl } from "@/components/brand/Bowl";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import { Button } from "@/components/ui/button";
import { PRESET_BY_ID } from "@/lib/brand/presets";

import type { DistrictRow } from "../../_data";
import {
  isThemePreset,
  type WizardFormInput,
  type WizardFormValues,
} from "../_schema";

type Props = {
  districts: DistrictRow[];
  logoFile: File | null;
  publishError: string | null;
  onJumpTo: (step: number) => void;
};

type PreviewCardProps = {
  step: number;
  label: string;
  onJumpTo: (step: number) => void;
  children: ReactNode;
};

// Preview card per the Claude Design treatment: bone bg, 16px radius,
// 1.5px border, mono uppercase label, click-through edit button to jump
// back to that step.
function PreviewCard({ step, label, onJumpTo, children }: PreviewCardProps) {
  return (
    <div
      data-testid={`review-card-${step}`}
      className="rounded-[16px] border-[1.5px] border-border bg-bone p-5"
    >
      <div className="mb-3.5 flex items-center justify-between">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
          {label}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onJumpTo(step)}
          data-testid={`review-edit-${step}`}
          className="h-7 gap-1 px-2 text-xs"
        >
          Edit
          <ChevronRight className="size-3" aria-hidden="true" />
        </Button>
      </div>
      {children}
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-2 text-[13px]">
      <span className="text-ink-subtle">{label} ·</span>
      <strong className="font-medium">{value}</strong>
    </div>
  );
}

export function Step5Review({ districts, logoFile, publishError, onJumpTo }: Props) {
  const form = useFormContext<WizardFormInput, unknown, WizardFormValues>();
  const values = form.getValues();

  const district = districts.find((d) => d.id === values.details.district_id);
  const presetLabel = isThemePreset(values.details.theme_preset)
    ? PRESET_BY_ID[values.details.theme_preset].label
    : "—";
  const previewPreset = isThemePreset(values.details.theme_preset)
    ? values.details.theme_preset
    : "atomic-red";
  const totalRinks = values.greens.greens.reduce((s, g) => {
    const n = typeof g.rink_count === "number" ? g.rink_count : Number(g.rink_count);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  const playerCount = values.players.players.length;
  const adminFirstInitial = values.adminInvite.admin_email
    ? values.adminInvite.admin_email.charAt(0).toUpperCase()
    : "?";

  return (
    <div data-testid="step-5-review" className="relative flex flex-col gap-4">
      <p className="text-sm text-ink-muted">
        Take a look — when you publish, the admin invite goes out and the club
        goes live.
      </p>

      {/* Splatter accent top-right per design. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-8 opacity-70"
      >
        <SplatterAccent
          preset={previewPreset}
          variant={0}
          size={280}
          rotate={20}
        />
      </div>

      {publishError && (
        <div
          data-testid="publish-error"
          role="alert"
          className="relative flex items-start gap-3 rounded-xl border border-danger-500/40 bg-danger-500/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger-500" />
          <div>
            <div className="font-semibold text-danger-500">
              Club wasn&apos;t created.
            </div>
            <p className="text-danger-500/90">{publishError}</p>
            <p className="mt-1 text-xs text-ink-subtle">
              Your wizard state is preserved — fix the issue and try again.
            </p>
          </div>
        </div>
      )}

      <div className="relative grid gap-4 md:grid-cols-2">
        {/* Card 1 — Club */}
        <PreviewCard step={1} label="Club" onJumpTo={onJumpTo}>
          <div className="mb-3.5 flex items-center gap-3.5">
            <Bowl preset={previewPreset} size={64} idSuffix="rev" />
            <div>
              <div className="font-display text-[22px] font-black italic uppercase tracking-[-0.01em] leading-none">
                {values.details.name || "Untitled club"}
              </div>
              <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-ink-subtle">
                {values.details.short_name || "—"} · {district?.name ?? "—"}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <MetaRow label="City" value={values.details.city || "—"} />
            <MetaRow
              label="Slug"
              value={
                <span className="font-mono text-[12px]">
                  {values.details.slug || "—"}
                </span>
              }
            />
            <MetaRow label="Theme" value={presetLabel} />
            {logoFile && (
              <MetaRow
                label="Logo"
                value={`${logoFile.name} (${Math.round(logoFile.size / 1024)} KB)`}
              />
            )}
          </div>
        </PreviewCard>

        {/* Card 2 — Club admin */}
        <PreviewCard step={2} label="Club admin" onJumpTo={onJumpTo}>
          <div className="mb-3.5 flex items-center gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink font-display text-xl font-extrabold text-ink-inverse">
              {adminFirstInitial}
            </div>
            <div className="min-w-0">
              <strong className="block truncate text-[15px]">
                {values.adminInvite.admin_email || "—"}
              </strong>
              <span className="font-mono text-[11px] text-ink-subtle">
                Primary admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-warning-500/10 px-2.5 py-2 text-[12px] text-[#8a6d00]">
            <Mail className="size-3.5" aria-hidden="true" />
            Invite emailed at publish.
          </div>
        </PreviewCard>

        {/* Card 3 — Greens */}
        <PreviewCard
          step={3}
          label={`Greens · ${values.greens.greens.length} ${
            values.greens.greens.length === 1 ? "green" : "greens"
          } · ${totalRinks} total ${totalRinks === 1 ? "rink" : "rinks"}`}
          onJumpTo={onJumpTo}
        >
          <ul className="flex flex-col gap-0 text-[13px]">
            {values.greens.greens.map((g, i) => {
              const rinks =
                typeof g.rink_count === "number"
                  ? g.rink_count
                  : Number(g.rink_count);
              return (
                <li
                  key={i}
                  className={`flex justify-between py-2 ${
                    i < values.greens.greens.length - 1
                      ? "border-b border-border"
                      : ""
                  }`}
                >
                  <strong>{g.name || <em>(unnamed)</em>}</strong>
                  <span className="font-mono text-ink-muted">
                    {Number.isFinite(rinks) ? rinks : "—"} rink{rinks === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
        </PreviewCard>

        {/* Card 4 — Initial players */}
        <PreviewCard step={4} label="Players" onJumpTo={onJumpTo}>
          <div className="font-display text-[48px] font-black italic leading-none">
            {playerCount}
          </div>
          <div className="mt-1 text-[13px] text-ink-subtle">
            {playerCount === 0
              ? "No initial players — the admin can invite them later."
              : "Initial invites — the admin can add the rest later."}
          </div>
        </PreviewCard>
      </div>
    </div>
  );
}
