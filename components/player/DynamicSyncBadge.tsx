"use client";

import { useTransition } from "react";

import { OfflineSyncBadge } from "@/components/player/OfflineSyncBadge";
import { useOutboxFlush } from "@/lib/scorecard/use-outbox-flush";
import { useSyncState } from "@/lib/scorecard/use-sync-state";

// Phase 8d — Client Component wrapper that derives the badge state
// from Dexie + wires the tap-to-retry behaviour. Mounted in the player
// layout's TopBar slot so every player surface gets live sync state
// without each surface having to wire the hook.
//
// Behaviour
//   • State (synced / pending / error) reflects current Dexie outbox
//     counts via `useSyncState`.
//   • Tap when state === "error" triggers a manual flush via
//     `useOutboxFlush().flushNow()`. No-op on synced/pending — those
//     auto-flush on online + visibility events from the same hook.

export function DynamicSyncBadge() {
  const { state, pendingCount } = useSyncState();
  const { flushNow } = useOutboxFlush();
  const [pending, startTransition] = useTransition();

  const handleClick =
    state === "error"
      ? () => {
          startTransition(async () => {
            await flushNow();
          });
        }
      : undefined;

  return (
    <OfflineSyncBadge
      state={pending ? "pending" : state}
      pendingCount={pendingCount}
      onClick={handleClick}
    />
  );
}
