import { cn } from "@/lib/utils";

type Props = {
  size?: number;
  className?: string;
};

export function HandiBowlsMark({ size = 40, className }: Props) {
  return (
    <svg
      aria-label="HandiBowls"
      role="img"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("select-none", className)}
    >
      <circle cx="32" cy="32" r="30" fill="var(--color-primary-500)" />
      <circle cx="32" cy="32" r="30" fill="none" stroke="var(--color-ink)" strokeWidth="2" opacity="0.15" />
      <circle cx="22" cy="24" r="2.2" fill="var(--color-speckle-a)" />
      <circle cx="42" cy="28" r="1.6" fill="var(--color-speckle-b)" />
      <circle cx="28" cy="40" r="1.8" fill="var(--color-speckle-a)" />
      <circle cx="44" cy="44" r="2.4" fill="var(--color-speckle-b)" />
      <circle cx="18" cy="38" r="1.2" fill="var(--color-speckle-a)" />
      <circle cx="38" cy="18" r="1.4" fill="var(--color-speckle-b)" />
      <circle cx="50" cy="22" r="3" fill="var(--color-on-primary)" opacity="0.9" />
    </svg>
  );
}
