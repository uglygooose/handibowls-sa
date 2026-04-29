"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { submitMatch } from "@/app/(club-admin)/manage/tournaments/_actions";

import { upsertMatchEnd, type UpsertMatchEndResult } from "./actions";
import {
  getDb,
  markSubmissionError,
  markSubmissionSynced,
  type MatchEndRow,
  type SubmissionRow,
} from "./outbox";

// Phase 8d — client-side outbox flush worker. Runs on online + focus
// events to drain Dexie's matchEnds + submissions queues against the
// server. Lives in the client (not in the service worker) so it can
// invoke Server Actions through the regular RSC POST path. The service
// worker handles cache strategies but doesn't replay action calls —
// double-flush would be a real risk if both layers ran.
//
// Phase 8g — conflict pipeline stripped. The original Phase 8d worker
// branched on `kind: "remote_newer"` and surfaced a conflict payload
// to a Scorecard-mounted ConflictResolutionSheet. That UI was removed
// in 8g (real-world likelihood of concurrent same-end scoring across
// two devices, one offline, both syncing through different timestamps
// is effectively zero for bowls). Server-side last-write-wins via
// migration 027 is the only conflict story now: whichever flush
// completes the UPDATE last wins.
//
// Two queues processed in order:
//
//   1. matchEnds — calls `upsertMatchEnd` per row. Two outcomes:
//        • `ok: true`           → mark row synced, advance.
//        • `auth | validation | db_error` → mark row errored, advance
//          to next row. Surface picks up the error state via the sync
//          badge and the user can tap-to-retry.
//
//   2. submissions — calls `submitMatch` per row. Same shape; the
//      server-side action is already idempotent w.r.t. double-submits.
//
// The hook returns:
//   • `state`           — { running, lastFlushedAt, lastError }
//   • `flushNow()`      — manual trigger (e.g. tap-to-retry from the
//                          OfflineSyncBadge error state)

export type FlushState = {
  running: boolean;
  lastFlushedAt: string | null;
  lastError: string | null;
};

export type UseOutboxFlushResult = {
  state: FlushState;
  flushNow: () => Promise<void>;
};

const FLUSH_THROTTLE_MS = 2_000;

export function useOutboxFlush(): UseOutboxFlushResult {
  const [state, setState] = useState<FlushState>({
    running: false,
    lastFlushedAt: null,
    lastError: null,
  });

  // Reentrancy guard: a focus event followed by a brief online event can
  // double-fire. Single in-flight flush at a time; the second call
  // becomes a no-op until the first resolves.
  const inFlightRef = useRef(false);
  const lastStartRef = useRef(0);

  const flushNow = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined") return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    if (inFlightRef.current) return;
    if (Date.now() - lastStartRef.current < FLUSH_THROTTLE_MS) return;
    inFlightRef.current = true;
    lastStartRef.current = Date.now();
    setState((s) => ({ ...s, running: true }));

    try {
      const db = getDb();

      // -- Phase A: match-end ends --------------------------------------
      // Per-match grouping isn't strictly required (each row is keyed
      // [matchId, endNumber]) but iterating per match keeps the action
      // calls naturally serialized for the same match.
      const queuedEnds = await db.matchEnds
        .where("syncStatus")
        .anyOf("queued", "error")
        .toArray();

      const byMatch = new Map<string, MatchEndRow[]>();
      for (const row of queuedEnds) {
        const list = byMatch.get(row.matchId) ?? [];
        list.push(row);
        byMatch.set(row.matchId, list);
      }

      for (const [, rows] of byMatch.entries()) {
        rows.sort((a, b) => a.endNumber - b.endNumber);
        for (const row of rows) {
          // Mark flushing so a concurrent re-render doesn't re-pick it.
          await db.matchEnds.update([row.matchId, row.endNumber] as unknown as string, {
            syncStatus: "flushing",
          });
          const result: UpsertMatchEndResult = await upsertMatchEnd({
            match_id: row.matchId,
            end_number: row.endNumber,
            home_shots: row.homeShots,
            away_shots: row.awayShots,
            local_updated_at: row.localUpdatedAt,
          });

          if (result.ok) {
            await db.matchEnds.update([row.matchId, row.endNumber] as unknown as string, {
              syncStatus: "synced",
              lastError: null,
            });
            continue;
          }

          // Auth / validation / db_error — mark errored, continue.
          const errorMessage =
            "error" in result && typeof result.error === "string"
              ? result.error
              : `Sync error (${result.kind})`;
          await db.matchEnds.update([row.matchId, row.endNumber] as unknown as string, {
            syncStatus: "error",
            lastError: errorMessage,
          });
        }
      }

      // -- Phase B: submissions -----------------------------------------
      const queuedSubs: SubmissionRow[] = await db.submissions
        .where("syncStatus")
        .anyOf("queued", "error")
        .toArray();
      for (const sub of queuedSubs) {
        await db.submissions.update(sub.matchId, {
          syncStatus: "flushing",
        });
        const result = await submitMatch({
          match_id: sub.matchId,
          home_shots: sub.homeShots,
          away_shots: sub.awayShots,
        });
        if (result.ok) {
          await markSubmissionSynced(sub.matchId);
        } else {
          await markSubmissionError(sub.matchId, result.error);
        }
      }

      setState({
        running: false,
        lastFlushedAt: new Date().toISOString(),
        lastError: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((s) => ({ ...s, running: false, lastError: message }));
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  // Auto-flush triggers: online + visibility return + initial mount.
  // Each trigger respects the throttle so a tab regaining focus while
  // also coming online doesn't double-flush.
  useEffect(() => {
    if (typeof window === "undefined") return;
    void flushNow();

    const onOnline = () => {
      void flushNow();
    };
    const onVis = () => {
      if (document.visibilityState === "visible") void flushNow();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [flushNow]);

  return { state, flushNow };
}

// Test-only — re-fetches a row's current local state. The flush worker's
// own state is opaque to consumers, but tests sometimes want to check
// what's in the queue after a flush attempt.
export async function _peekMatchEndForTests(
  matchId: string,
  endNumber: number,
): Promise<MatchEndRow | undefined> {
  const all = await import("./outbox").then((m) =>
    m.listMatchEndsForMatch(matchId),
  );
  return all.find((r) => r.endNumber === endNumber);
}
