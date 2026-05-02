"use client";

import { cn } from "@/lib/utils";

// Phase 8 player surface — outbox sync indicator for the mobile top bar.
// Three states match the offline-first UX in the design source:
//
//   • synced  — "All saved", default green pill (no pending writes)
//   • pending — "{n} ends pending", amber pill (writes queued in the
//               Dexie outbox; service worker will flush when online)
//   • error   — "Sync error", red pill (last flush attempt rejected;
//               user action may be needed for conflict resolution)
//
// Wired across all player surfaces by 8d once the Dexie outbox lands
// (Phase-8d capability gap). For 8-prep this primitive is self-contained
// and consumer-controlled: callers pass `state` + an optional pending
// count + an optional click handler that opens the sync detail sheet.

export type SyncState = "synced" | "pending" | "error";

type Props = {
  state: SyncState;
  /** Pending writes count when state === "pending". Surfaces as the
   *  pill label suffix (e.g. "3 ends pending"). Ignored otherwise. */
  pendingCount?: number;
  /** Click handler — typically opens the sync-detail bottom sheet so
   *  the user can manually retry or inspect the queue. Optional. */
  onClick?: () => void;
  className?: string;
};

// Phase 13 / 13-1 / commit 9 — text foreground swept from
// text-{success,warning,danger}-{500,700} → text-ink. The previous 700-tier
// foreground (Tier-A swap from 500-tier) cleared 4.5:1 against bone but
// not against the tinted-pill background `bg-{tone}-500/{12,16}` which
// resolves to a near-surface tint when composited over bg-bone or
// bg-surface-muted (the M2 axe baseline flagged 7-9 nodes per player route
// across /play, /tournaments/[id], /t20, /me, /manage, /manage/members).
// text-ink is theme-invariant high contrast (19.80:1 on bone, 18.93:1 on
// surface) so the badge passes AA on every theme + every chrome context.
// The colored dot stays brand-tinted to retain at-a-glance state cue;
// state-meaning is communicated by both dot color AND label text.
const TONE: Record<
  SyncState,
  { bg: string; ring: string; text: string; dot: string }
> = {
  synced: {
    bg: "bg-success-500/12",
    ring: "ring-success-500/30",
    text: "text-ink",
    dot: "bg-success-500",
  },
  pending: {
    bg: "bg-warning-500/16",
    ring: "ring-warning-500/40",
    text: "text-ink",
    dot: "bg-warning-500",
  },
  error: {
    bg: "bg-danger-500/16",
    ring: "ring-danger-500/40",
    text: "text-ink",
    dot: "bg-danger-500",
  },
};

function labelFor(state: SyncState, pendingCount: number | undefined): string {
  if (state === "synced") return "All saved";
  if (state === "error") return "Sync error";
  const n = Math.max(0, pendingCount ?? 0);
  return `${n} ${n === 1 ? "end" : "ends"} pending`;
}

export function OfflineSyncBadge({
  state,
  pendingCount,
  onClick,
  className,
}: Props) {
  const tone = TONE[state];
  const label = labelFor(state, pendingCount);
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      data-slot="offline-sync-badge"
      data-state={state}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      aria-label={`Sync status: ${label}`}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 ring-1 ring-inset",
        "font-mono text-[10.5px] font-bold uppercase tracking-[0.06em]",
        tone.bg,
        tone.ring,
        tone.text,
        onClick && "cursor-pointer transition-colors hover:bg-opacity-90",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-[7px] shrink-0 rounded-full", tone.dot)}
      />
      {label}
    </Tag>
  );
}
