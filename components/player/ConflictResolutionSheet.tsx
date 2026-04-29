"use client";

import { ArrowRight, Cloud, Flag, Smartphone } from "lucide-react";

import { BottomSheet } from "@/components/player/BottomSheet";
import { cn } from "@/lib/utils";
import { formatRelativeZA } from "@/lib/format/relative";

// Phase 8d — conflict resolution sheet. Triggered when the outbox
// flush worker reports `kind: 'remote_newer'` for an end. The sheet
// shows both versions side-by-side with timestamps and offers three
// resolutions:
//
//   • Use mine    — re-write the local row's localUpdatedAt to now()
//                   so the next flush wins LWW. The actual rewrite
//                   happens in the consumer's onUseMine callback.
//   • Use theirs  — overwrite local with the server's values + mark
//                   the row synced. Consumer handles via onUseTheirs.
//   • Dispute     — open the dispute form and route to the
//                   admin-resolution path. Consumer wires via onDispute.
//
// The component is purely presentational — all three callbacks are
// caller-controlled. Keeps the sheet reusable across surfaces if a
// future flow (e.g. admin-side reconciliation) needs the same UI.

export type ConflictPayload = {
  match_id: string;
  end_number: number;
  local: { home_shots: number; away_shots: number; localUpdatedAt: string };
  server: { home_shots: number; away_shots: number; updated_at: string };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflict: ConflictPayload | null;
  onUseMine: (c: ConflictPayload) => Promise<void> | void;
  onUseTheirs: (c: ConflictPayload) => Promise<void> | void;
  onDispute: (c: ConflictPayload) => void;
  pending?: boolean;
};

export function ConflictResolutionSheet({
  open,
  onOpenChange,
  conflict,
  onUseMine,
  onUseTheirs,
  onDispute,
  pending = false,
}: Props) {
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange}>
      <BottomSheet.Content>
        <div className="flex flex-col gap-3 px-4 pb-2 pt-1">
          <BottomSheet.Title asChild>
            <h3 className="font-display text-[22px] font-black italic uppercase tracking-tight">
              End {conflict?.end_number ?? ""} disagreement
            </h3>
          </BottomSheet.Title>
          <BottomSheet.Description className="text-[13px] text-ink-muted">
            The server has a different version of this end. Pick which to
            keep, or dispute and let the admin resolve it.
          </BottomSheet.Description>

          {conflict && (
            <div className="grid grid-cols-2 gap-2">
              <Card
                tone="local"
                icon={<Smartphone className="size-4" aria-hidden="true" />}
                title="On this phone"
                stamp={formatRelativeZA(conflict.local.localUpdatedAt)}
                home={conflict.local.home_shots}
                away={conflict.local.away_shots}
              />
              <Card
                tone="server"
                icon={<Cloud className="size-4" aria-hidden="true" />}
                title="On the server"
                stamp={formatRelativeZA(conflict.server.updated_at)}
                home={conflict.server.home_shots}
                away={conflict.server.away_shots}
              />
            </div>
          )}

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              disabled={!conflict || pending}
              onClick={() => conflict && void onUseMine(conflict)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary-500 text-[13px] font-extrabold uppercase tracking-[0.04em] text-[color:var(--color-on-primary)] disabled:opacity-60"
            >
              <Smartphone className="size-4" aria-hidden="true" />
              Use mine — overwrite the server
              <ArrowRight className="size-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={!conflict || pending}
              onClick={() => conflict && void onUseTheirs(conflict)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-border bg-surface text-[13px] font-bold text-ink hover:bg-surface-muted disabled:opacity-60"
            >
              <Cloud className="size-4" aria-hidden="true" />
              Use theirs — keep the server version
            </button>
            <button
              type="button"
              disabled={!conflict || pending}
              onClick={() => conflict && onDispute(conflict)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-danger-500/40 bg-surface text-[13px] font-bold text-danger-500 hover:bg-danger-500/8 disabled:opacity-60"
            >
              <Flag className="size-3.5" aria-hidden="true" />
              Dispute — let admin decide
            </button>
          </div>
        </div>
      </BottomSheet.Content>
    </BottomSheet>
  );
}

function Card({
  tone,
  icon,
  title,
  stamp,
  home,
  away,
}: {
  tone: "local" | "server";
  icon: React.ReactNode;
  title: string;
  stamp: string;
  home: number;
  away: number;
}) {
  return (
    <div
      data-slot="conflict-version-card"
      data-tone={tone}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border bg-surface p-3",
        tone === "local"
          ? "border-primary-500/40 ring-1 ring-inset ring-primary-500/10"
          : "border-warning-500/40 ring-1 ring-inset ring-warning-500/10",
      )}
    >
      <div className="flex items-center gap-1.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-muted">
        {icon}
        {title}
      </div>
      <div className="flex items-baseline justify-between font-mono">
        <span className="text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
          Home
        </span>
        <span className="font-display text-[24px] font-black italic tabular-nums">
          {home}
        </span>
      </div>
      <div className="flex items-baseline justify-between font-mono">
        <span className="text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
          Away
        </span>
        <span className="font-display text-[24px] font-black italic tabular-nums">
          {away}
        </span>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-subtle">
        {stamp}
      </span>
    </div>
  );
}
