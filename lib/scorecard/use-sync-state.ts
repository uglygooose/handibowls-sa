"use client";

import { useLiveQuery } from "dexie-react-hooks";

import type { SyncState } from "@/components/player/OfflineSyncBadge";

import { getDb } from "./outbox";

// Phase 8d — derives the OfflineSyncBadge state from the Dexie outbox
// across player surfaces. Counts queued + flushing + errored rows and
// maps to the three badge states:
//
//   • all rows synced      → "synced"
//   • any errored row      → "error"
//   • any queued/flushing  → "pending"
//
// Returns the badge state + a pendingCount for the "{n} ends pending"
// label. SSR-safe via the same useLiveQuery pattern the scorecard
// already uses — useLiveQuery returns undefined on the first render
// then the live count.

export type UseSyncStateResult = {
  state: SyncState;
  pendingCount: number;
};

export function useSyncState(): UseSyncStateResult {
  const result = useLiveQuery(
    async () => {
      if (typeof window === "undefined") {
        return { errored: 0, pending: 0 };
      }
      const db = getDb();
      // Count rows by syncStatus across BOTH tables. The badge surfaces
      // a single sync state per device — we don't differentiate ends vs
      // submissions in the badge. Pending is queued+flushing; error is
      // any errored row.
      const [endsErrored, endsPending, subsErrored, subsPending] = await Promise.all([
        db.matchEnds.where("syncStatus").equals("error").count(),
        db.matchEnds.where("syncStatus").anyOf("queued", "flushing").count(),
        db.submissions.where("syncStatus").equals("error").count(),
        db.submissions.where("syncStatus").anyOf("queued", "flushing").count(),
      ]);
      return {
        errored: endsErrored + subsErrored,
        pending: endsPending + subsPending,
      };
    },
    [],
    { errored: 0, pending: 0 },
  );

  const errored = result?.errored ?? 0;
  const pending = result?.pending ?? 0;
  const state: SyncState =
    errored > 0 ? "error" : pending > 0 ? "pending" : "synced";
  return { state, pendingCount: pending };
}
