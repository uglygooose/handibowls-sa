"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { BowlChip } from "@/components/brand/BowlChip";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { THEME_PRESETS, type ThemePreset } from "@/components/brand/ThemeApplier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PRESET_BY_ID } from "@/lib/brand/presets";
import { cn } from "@/lib/utils";

import { updateClubTheme } from "../../_actions";

type Props = {
  clubId: string;
  clubName: string;
  current: ThemePreset;
};

// Theme picker for the club detail page. The only interactive surface in
// this phase — every other tab is read-only. Writes go through the existing
// updateClubTheme server action; a confirm dialog gates the DB write so an
// accidental click can't re-theme a live club.
export function ThemeTab({ clubId, clubName, current }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<ThemePreset>(current);
  const [pendingChoice, setPendingChoice] = useState<ThemePreset | null>(null);
  const [isPending, startTransition] = useTransition();

  const previewSwatch = PRESET_BY_ID[preview];

  function handlePick(preset: ThemePreset) {
    setPreview(preset);
    if (preset !== current) setPendingChoice(preset);
  }

  function handleConfirm() {
    if (!pendingChoice) return;
    startTransition(async () => {
      const result = await updateClubTheme({
        club_id: clubId,
        theme_preset: pendingChoice,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Theme updated to ${PRESET_BY_ID[pendingChoice].label}.`);
      setPendingChoice(null);
      router.refresh();
    });
  }

  function handleCancel() {
    setPendingChoice(null);
    setPreview(current);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Choose a preset</CardTitle>
        </CardHeader>
        <CardContent>
          <ul
            role="radiogroup"
            aria-label="Club theme preset"
            className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5"
            data-testid="theme-presets"
          >
            {THEME_PRESETS.map((preset) => {
              const sw = PRESET_BY_ID[preset];
              const isCurrent = preset === current;
              const isSelected = preset === preview;
              return (
                <li key={preset}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={sw.label}
                    data-testid={`theme-preset-${preset}`}
                    data-current={isCurrent ? "true" : undefined}
                    onClick={() => handlePick(preset)}
                    className={cn(
                      "flex w-full flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isSelected
                        ? "border-foreground bg-muted/60"
                        : "border-border hover:bg-muted/30",
                    )}
                  >
                    <BowlChip preset={preset} size={44} selected={isSelected} />
                    <span className="text-xs font-medium leading-tight">{sw.label}</span>
                    {isCurrent && (
                      <Badge variant="outline" className="text-[10px]">
                        Current
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card data-testid="theme-preview">
        <CardHeader>
          <CardTitle>Live preview</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div
            className="relative isolate flex h-40 items-end overflow-hidden rounded-xl p-4 ring-1 ring-foreground/10"
            style={{ backgroundColor: previewSwatch.base, color: previewSwatch.on }}
            data-testid="theme-preview-swatch"
            data-preset={preview}
          >
            <SpeckleLayer seed={`preview-${preview}`} density="med" opacity={0.18} />
            <div className="relative z-10 flex items-center gap-3">
              <BowlChip preset={preview} size={40} />
              <div className="flex flex-col leading-tight">
                <span className="font-display text-base font-bold">{clubName}</span>
                <span className="text-xs opacity-80">{previewSwatch.label}</span>
              </div>
            </div>
          </div>
          <p className="text-xs text-ink-muted">
            Preview only — click a preset, then confirm to apply the change
            to this club&apos;s live theme for every member.
          </p>
        </CardContent>
      </Card>

      <Dialog open={pendingChoice !== null} onOpenChange={(o) => !o && handleCancel()}>
        <DialogContent data-testid="theme-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Apply new theme?</DialogTitle>
            <DialogDescription>
              {pendingChoice && (
                <>
                  Switch <strong>{clubName}</strong> from{" "}
                  <code>{current}</code> to <code>{pendingChoice}</code>. Every
                  member of this club will see the new theme on their next page
                  load.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              data-testid="theme-confirm"
            >
              {isPending ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
