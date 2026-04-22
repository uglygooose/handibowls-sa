import { cn } from "@/lib/utils";
import type { ThemePreset } from "@/components/brand/ThemeApplier";
import { PRESET_BY_ID } from "@/lib/brand/presets";

type Props = {
  preset: ThemePreset;
  size?: number;
  selected?: boolean;
  label?: string;
  className?: string;
};

export function BowlChip({
  preset,
  size = 40,
  selected = false,
  label,
  className,
}: Props) {
  const sw = PRESET_BY_ID[preset];
  const title = label ?? sw.label;
  const [speckleA, speckleB] = sw.speckle;

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
        fill={sw.base}
        stroke={selected ? "var(--color-ink)" : "var(--color-border)"}
        strokeWidth={selected ? 3 : 1.5}
      />
      <circle cx="24" cy="26" r="2" fill={speckleA} />
      <circle cx="40" cy="30" r="1.4" fill={speckleB} />
      <circle cx="28" cy="42" r="1.6" fill={speckleA} />
      <circle cx="42" cy="44" r="2.2" fill={speckleB} />
      <circle cx="20" cy="40" r="1" fill={speckleA} />
      <circle cx="46" cy="24" r="2.6" fill={sw.on} opacity="0.85" />
    </svg>
  );
}
