import { cn } from "@/lib/utils";

type Props = {
  // Short identifier shown in the chip — typically clubs.short_name (e.g. "RBC").
  // The container surfaces a list of these for users with multiple memberships.
  short: string;
  className?: string;
};

// Compact mono-uppercase chip per the Claude Design treatment. Used in
// the users table's "Clubs" column and anywhere a player's affiliations
// need a visually compressed listing.
export function ClubChip({ short, className }: Props) {
  return (
    <span
      data-slot="club-chip"
      className={cn(
        "inline-flex rounded-md bg-surface-muted px-2 py-0.5",
        "font-mono text-[10px] font-semibold tracking-[0.04em] text-ink-muted",
        className,
      )}
    >
      {short}
    </span>
  );
}
