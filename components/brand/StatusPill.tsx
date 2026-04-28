import { cn } from "@/lib/utils";

export type Status = "active" | "inactive" | "live" | "upcoming" | "closed" | "live-now";

type Props = {
  status: Status;
  className?: string;
  // Caller-supplied label override; otherwise pretty-printed from status.
  label?: string;
};

// Status pill per the Claude Design treatment: rounded-full pill with a
// 6px coloured dot prefix, font-mono uppercase 11px label. Used on the
// clubs table, tournaments table, and the club hero.
//
// Tone groups:
//   active / live / upcoming / live-now → success-500 (running, healthy)
//   inactive / closed                   → ink-muted (archived, finished)
const TONE_BY_STATUS: Record<Status, "success" | "muted"> = {
  active: "success",
  live: "success",
  upcoming: "success",
  "live-now": "success",
  inactive: "muted",
  closed: "muted",
};

const PRETTY_LABEL: Record<Status, string> = {
  active: "Active",
  inactive: "Inactive",
  live: "Live",
  upcoming: "Upcoming",
  closed: "Closed",
  "live-now": "Live now",
};

export function StatusPill({ status, label, className }: Props) {
  const tone = TONE_BY_STATUS[status];
  return (
    <span
      data-slot="status-pill"
      data-tone={tone}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px]",
        "font-mono text-[11px] font-semibold uppercase tracking-[0.06em]",
        tone === "success"
          ? "bg-success-500/10 text-success-500"
          : "bg-ink-muted/10 text-ink-muted",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 rounded-full",
          tone === "success" ? "bg-success-500" : "bg-ink-muted",
        )}
      />
      {label ?? PRETTY_LABEL[status]}
    </span>
  );
}
