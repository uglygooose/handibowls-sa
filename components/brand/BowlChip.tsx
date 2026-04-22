import { cn } from "@/lib/utils";
import type { ThemePreset } from "@/components/brand/ThemeApplier";

type Props = {
  preset: ThemePreset;
  size?: number;
  selected?: boolean;
  label?: string;
  className?: string;
};

// Per-preset swatch values. Mirrors app/globals.css so the chip renders
// the correct preset regardless of the currently active html[data-theme].
const PRESET_SWATCH: Record<
  ThemePreset,
  { primary: string; speckleA: string; speckleB: string; onPrimary: string }
> = {
  "atomic-red":    { primary: "#D7261E", speckleA: "#000000", speckleB: "#FAFAF7", onPrimary: "#FFFFFF" },
  "ocean-blue":    { primary: "#1E4DD8", speckleA: "#3FB8AF", speckleB: "#FAFAF7", onPrimary: "#FFFFFF" },
  "sunburst":      { primary: "#F5B700", speckleA: "#0A0A0A", speckleB: "#0E7C7B", onPrimary: "#0A0A0A" },
  "midnight":      { primary: "#0E1B3D", speckleA: "#D7261E", speckleB: "#F5B700", onPrimary: "#FFFFFF" },
  "ruby":          { primary: "#C2185B", speckleA: "#0A0A0A", speckleB: "#FAFAF7", onPrimary: "#FFFFFF" },
  "ocean-green":   { primary: "#0E7C7B", speckleA: "#3FB8AF", speckleB: "#0A0A0A", onPrimary: "#FFFFFF" },
  "grape":         { primary: "#6A1B9A", speckleA: "#EC407A", speckleB: "#FAFAF7", onPrimary: "#FFFFFF" },
  "white-speckle": { primary: "#F4F4F4", speckleA: "#D7261E", speckleB: "#1E4DD8", onPrimary: "#0A0A0A" },
  "core-black":    { primary: "#0A0A0A", speckleA: "#D7261E", speckleB: "#FAFAF7", onPrimary: "#FFFFFF" },
};

export function BowlChip({
  preset,
  size = 40,
  selected = false,
  label,
  className,
}: Props) {
  const sw = PRESET_SWATCH[preset];
  const title = label ?? preset;

  return (
    <svg
      aria-label={title}
      role="img"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn(
        "select-none transition-transform",
        selected && "scale-110 drop-shadow",
        className,
      )}
    >
      <title>{title}</title>
      <circle
        cx="32"
        cy="32"
        r="28"
        fill={sw.primary}
        stroke={selected ? "var(--color-ink)" : "var(--color-border)"}
        strokeWidth={selected ? 3 : 1.5}
      />
      <circle cx="24" cy="26" r="2" fill={sw.speckleA} />
      <circle cx="40" cy="30" r="1.4" fill={sw.speckleB} />
      <circle cx="28" cy="42" r="1.6" fill={sw.speckleA} />
      <circle cx="42" cy="44" r="2.2" fill={sw.speckleB} />
      <circle cx="20" cy="40" r="1" fill={sw.speckleA} />
      <circle cx="46" cy="24" r="2.6" fill={sw.onPrimary} opacity="0.85" />
    </svg>
  );
}
