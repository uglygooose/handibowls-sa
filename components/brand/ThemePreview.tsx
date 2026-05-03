import { BowlChip } from "@/components/brand/BowlChip";
import { SpeckleLayer } from "@/components/brand/SpeckleLayer";
import { type ThemePreset } from "@/components/brand/theme-presets";
import { PRESET_BY_ID } from "@/lib/brand/presets";
import { cn } from "@/lib/utils";

type Props = {
  preset: ThemePreset;
  label: string;
  className?: string;
  "data-testid"?: string;
};

export function ThemePreview({
  preset,
  label,
  className,
  "data-testid": testId = "theme-preview-swatch",
}: Props) {
  const swatch = PRESET_BY_ID[preset];
  return (
    <div
      className={cn(
        "relative isolate flex h-40 items-end overflow-hidden rounded-[14px] p-4 ring-1 ring-foreground/10",
        className,
      )}
      style={{ backgroundColor: swatch.base, color: swatch.on }}
      data-testid={testId}
      data-preset={preset}
    >
      <SpeckleLayer seed={`preview-${preset}`} density="med" opacity={0.18} />
      <div className="relative z-10 flex items-center gap-3">
        <BowlChip preset={preset} size={40} />
        <div className="flex flex-col leading-tight">
          <span className="font-display text-base font-bold">{label}</span>
          <span className="text-xs opacity-80">{swatch.label}</span>
        </div>
      </div>
    </div>
  );
}
