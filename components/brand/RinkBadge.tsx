import { cn } from "@/lib/utils";

type Props = {
  rink: number | string;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "outline";
  className?: string;
};

export function RinkBadge({
  rink,
  size = "md",
  variant = "solid",
  className,
}: Props) {
  const sizes = {
    sm: "h-6 min-w-6 px-1.5 text-xs",
    md: "h-8 min-w-8 px-2 text-sm",
    lg: "h-10 min-w-10 px-3 text-base",
  } as const;

  return (
    <span
      data-slot="rink-badge"
      aria-label={`Rink ${rink}`}
      className={cn(
        "inline-flex items-center justify-center gap-1 rounded-full font-display font-bold tracking-wide tabular-nums",
        variant === "solid"
          ? "bg-primary-500 text-[color:var(--color-on-primary)]"
          : "border-2 border-primary-500 text-accent-ink",
        sizes[size],
        className,
      )}
    >
      <span className="opacity-70 text-[0.7em] uppercase">R</span>
      <span>{rink}</span>
    </span>
  );
}
