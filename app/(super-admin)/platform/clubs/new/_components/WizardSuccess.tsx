"use client";

import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";

import { Bowl } from "@/components/brand/Bowl";
import { SplatterAccent } from "@/components/brand/SplatterAccent";
import type { ThemePreset } from "@/components/brand/theme-presets";
import { Button } from "@/components/ui/button";

type Props = {
  clubId: string;
  clubName: string;
  themePreset: ThemePreset;
  districtName: string;
  adminEmail: string;
  greensCount: number;
  totalRinks: number;
};

// Celebratory state per the Claude Design WizardSuccess banner. Renders
// after a successful publish — themed bowl + sunburst sidekick + corner
// splatters + a 3-item checklist of what just happened + CTAs.
export function WizardSuccess({
  clubId,
  clubName,
  themePreset,
  districtName,
  adminEmail,
  greensCount,
  totalRinks,
}: Props) {
  return (
    <div
      data-testid="wizard-success"
      className="relative overflow-hidden rounded-[18px] bg-bone px-10 py-20 text-center"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-16 opacity-55"
      >
        <SplatterAccent preset={themePreset} variant={0} size={360} rotate={18} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -left-10 opacity-40"
      >
        <SplatterAccent preset="atomic-red" variant={2} size={260} rotate={-22} />
      </div>

      <div className="relative">
        <div className="mb-8 flex items-end justify-center gap-4">
          <Bowl preset={themePreset} size={150} idSuffix="suc-1" />
          <Bowl preset="sunburst" size={90} idSuffix="suc-2" />
        </div>
        <h1 className="m-0 mb-4 font-display text-[64px] font-black italic uppercase tracking-[-0.02em] leading-[0.9]">
          {clubName} <em className="not-italic italic text-primary-500">is live.</em>
        </h1>
        <p className="m-0 mb-6 text-ink-muted">Three things just happened:</p>
        <ul className="mx-auto mb-8 flex max-w-[480px] list-none flex-col gap-2 p-0 text-left">
          <li className="flex items-center gap-2.5 rounded-[10px] border border-border bg-bone px-3.5 py-3 text-sm">
            <Check className="size-4 shrink-0 text-success-500" aria-hidden="true" />
            <span>
              Club created in <strong>{districtName}</strong>
            </span>
          </li>
          <li className="flex items-center gap-2.5 rounded-[10px] border border-border bg-bone px-3.5 py-3 text-sm">
            <Check className="size-4 shrink-0 text-success-500" aria-hidden="true" />
            <span>
              Invite emailed to <strong>{adminEmail}</strong>
            </span>
          </li>
          <li className="flex items-center gap-2.5 rounded-[10px] border border-border bg-bone px-3.5 py-3 text-sm">
            <Check className="size-4 shrink-0 text-success-500" aria-hidden="true" />
            <span>
              {greensCount} {greensCount === 1 ? "green" : "greens"} · {totalRinks}{" "}
              rinks configured
            </span>
          </li>
        </ul>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Button asChild size="xl" className="gap-1.5">
            <Link href={`/platform/clubs/${clubId}`}>
              View club
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link href="/platform/clubs/new">Add another club</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
