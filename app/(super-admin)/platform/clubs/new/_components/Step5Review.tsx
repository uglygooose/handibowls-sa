"use client";

import { AlertTriangle, ChevronRight } from "lucide-react";
import { useFormContext } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { PRESET_BY_ID } from "@/lib/brand/presets";

import type { DistrictRow } from "../../_data";
import { isThemePreset, type WizardFormValues } from "../_schema";

type Props = {
  districts: DistrictRow[];
  logoFile: File | null;
  publishError: string | null;
  onJumpTo: (step: number) => void;
};

type SummaryCardProps = {
  step: number;
  title: string;
  onJumpTo: (step: number) => void;
  children: React.ReactNode;
};

function SummaryCard({ step, title, onJumpTo, children }: SummaryCardProps) {
  return (
    <div
      data-testid={`review-card-${step}`}
      className="rounded-xl border border-border p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
            {step}
          </span>
          <h3 className="font-mono text-[11px] tracking-[0.12em] uppercase text-ink-muted">
            {title}
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onJumpTo(step)}
          data-testid={`review-edit-${step}`}
        >
          Edit
          <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
      <div className="text-sm">{children}</div>
    </div>
  );
}

function field(label: string, value: string | number | null | undefined) {
  const display =
    value === null || value === undefined || value === ""
      ? "—"
      : String(value);
  return (
    <div className="flex gap-2">
      <dt className="w-[120px] shrink-0 font-mono text-[10px] tracking-[0.08em] uppercase text-ink-muted pt-0.5">
        {label}
      </dt>
      <dd>{display}</dd>
    </div>
  );
}

export function Step5Review({ districts, logoFile, publishError, onJumpTo }: Props) {
  const form = useFormContext<WizardFormValues>();
  const values = form.getValues();

  const district = districts.find((d) => d.id === values.details.district_id);
  const presetLabel = isThemePreset(values.details.theme_preset)
    ? PRESET_BY_ID[values.details.theme_preset].label
    : "—";

  const adminPromotions = values.players.players.filter((p) => p.is_club_admin);
  const regularPlayers = values.players.players.filter((p) => !p.is_club_admin);

  return (
    <div data-testid="step-5-review" className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Last look. Click any section to jump back and edit. The club is only
        created when you hit <strong>Create club</strong> below.
      </p>

      {publishError && (
        <div
          data-testid="publish-error"
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div>
            <div className="font-semibold text-destructive">
              Club wasn&apos;t created.
            </div>
            <p className="text-destructive/90">{publishError}</p>
            <p className="mt-1 text-xs text-ink-subtle">
              Your wizard state is preserved — fix the issue and try again.
            </p>
          </div>
        </div>
      )}

      <SummaryCard step={1} title="Club details" onJumpTo={onJumpTo}>
        <dl className="grid gap-1.5">
          {field("Name", values.details.name)}
          {field("Short name", values.details.short_name)}
          {field("Slug", values.details.slug)}
          {field("District", district?.name)}
          {field("City", values.details.city)}
          {field("Contact email", values.details.contact_email)}
          {field("Contact phone", values.details.contact_phone)}
          {field("Theme", presetLabel)}
          {field(
            "Logo",
            logoFile ? `${logoFile.name} (${Math.round(logoFile.size / 1024)} KB)` : null,
          )}
        </dl>
      </SummaryCard>

      <SummaryCard step={2} title="Club admin" onJumpTo={onJumpTo}>
        <dl className="grid gap-1.5">
          {field("Admin email", values.adminInvite.admin_email)}
        </dl>
      </SummaryCard>

      <SummaryCard step={3} title="Greens & rinks" onJumpTo={onJumpTo}>
        <ul className="flex flex-col gap-1">
          {values.greens.greens.map((g, i) => (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-xs text-ink-muted">#{i + 1}</span>
              <span className="flex-1">{g.name || <em>(unnamed)</em>}</span>
              <span className="tabular-nums text-ink-muted">
                {g.rink_count} rink{g.rink_count === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
      </SummaryCard>

      <SummaryCard step={4} title="Initial players" onJumpTo={onJumpTo}>
        {values.players.players.length === 0 ? (
          <p className="text-ink-subtle">No initial players — you can invite them later.</p>
        ) : (
          <>
            <p className="mb-2">
              <strong>{regularPlayers.length}</strong> player
              {regularPlayers.length === 1 ? "" : "s"}
              {adminPromotions.length > 0 && (
                <>
                  {" "}
                  + <strong>{adminPromotions.length}</strong> additional admin
                  {adminPromotions.length === 1 ? "" : "s"}
                </>
              )}
              {" will each get an invite."}
            </p>
            <ul className="max-h-48 overflow-auto text-sm">
              {values.players.players.map((p, i) => (
                <li key={i} className="flex gap-3 py-1">
                  <span className="flex-1">
                    {p.first_name} {p.last_name}
                  </span>
                  <span className="text-ink-muted">{p.email}</span>
                  {p.is_club_admin && (
                    <span className="rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-500">
                      admin
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </SummaryCard>
    </div>
  );
}
