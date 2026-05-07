import { Bowl } from "@/components/brand/Bowl";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { PRESET_BY_ID } from "@/lib/brand/presets";
import { cn } from "@/lib/utils";

type Props = {
  preset: ThemePreset;
  size?: number;
  selected?: boolean;
  label?: string;
  className?: string;
};

// Theme-picker swatch + footer chip-row. Phase 15 — wraps the canonical
// <Bowl /> so every Henselite-branded glyph ships from one place. The
// chip itself is just a sized container that applies a selected-state
// ring/scale; Bowl owns the visual + a11y. `preset` pins the bowl to a
// specific theme regardless of the active CSS theme — that's the
// theme-picker contract (each chip in a grid renders its own preset
// even though only one preset is "active" on the page).
export function BowlChip({
  preset,
  size = 40,
  selected = false,
  label,
  className,
}: Props) {
  const title = label ?? PRESET_BY_ID[preset].label;
  return (
    <span
      data-slot="bowl-chip"
      data-selected={selected || undefined}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full transition-transform",
        selected && "scale-110 drop-shadow",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Bowl themeId={preset} size={size} ariaLabel={title} />
    </span>
  );
}
