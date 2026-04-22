import { cn } from "@/lib/utils";

type Props = {
  variant?: "light" | "dark";
  className?: string;
  height?: number;
};

export function HandiBowlsWordmark({
  variant = "light",
  className,
  height = 40,
}: Props) {
  const fill = variant === "light" ? "var(--color-ink)" : "var(--color-ink-inverse)";
  const accent = "var(--color-primary-500)";
  // Explicit width = height * viewBox aspect. Without this, some layout
  // contexts (flex ancestors, truncating parents) render the SVG at its
  // intrinsic viewBox width (360), causing the wordmark to be clipped.
  const width = Math.round((height * 360) / 64);

  return (
    <svg
      aria-label="HandiBowls"
      role="img"
      viewBox="0 0 360 64"
      width={width}
      height={height}
      className={cn("block shrink-0 select-none", className)}
    >
      <text
        x="0"
        y="48"
        fontFamily="var(--font-display)"
        fontWeight={900}
        fontStyle="italic"
        fontSize="56"
        fill={fill}
        letterSpacing="-0.02em"
      >
        HANDI
      </text>
      <text
        x="162"
        y="48"
        fontFamily="var(--font-display)"
        fontWeight={900}
        fontStyle="italic"
        fontSize="56"
        fill={accent}
        letterSpacing="-0.02em"
      >
        BOWLS
      </text>
      <circle cx="340" cy="14" r="6" fill={accent} />
      <circle cx="348" cy="10" r="2" fill={fill} />
      <circle cx="336" cy="18" r="1.5" fill="var(--color-speckle-a)" />
    </svg>
  );
}
