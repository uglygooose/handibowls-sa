"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { submitMatch } from "@/app/(club-admin)/manage/tournaments/_actions";

import { upsertMatchEnd, type UpsertMatchEndResult } from "./actions";
import {
  getDb,
  listMatchEndsForMatch,
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
// Two queues processed in order:
//
//   1. matchEnds — calls `upsertMatchEnd` per row. Three outcomes:
//        • `ok: true`           → mark row synced, advance.
//        • `remote_newer`       → push to the conflict callback so
//                                  the surface can render the modal.
//                                  Stop processing the queue (the
//                                  user's resolution choice may rewrite
//                                  the row before resuming).
//        • `db_error` / `auth`  → mark row errored, advance to next
//                                  row. Surface picks up the error
//                                  state via the sync badge.
//
//   2. submissions — calls `submitMatch` per row. Same three-outcome
//      shape minus the conflict path (submissions are per-match, not
//      per-end, and the server-side action is already idempotent w.r.t.
//      double-submits).
//
// The hook returns:
//   • `state`           — { running, lastFlushedAt, lastError }
//   • `flushNow()`      — manual trigger (e.g. tap-to-retry from the
//                          OfflineSyncBadge error state)
//   • `pendingConflict` — null or the latest conflict payload — feeds
//                          the conflict-resolution sheet trigger.
//   • `clearConflict()` — call after the modal handles a conflict.

export type ConflictPayload = {
  match_id: string;
  end_number: number;
  local: { home_shots: number; away_shots: number; localUpdatedAt: string };
  server: { home_shots: number; away_shots: number; updated_at: string };
};

export type FlushState = {
  running: boolean;
  lastFlushedAt: string | null;
  lastError: string | null;
};

export type UseOutboxFlushResult = {
  state: FlushState;
  flushNow: () => Promise<void>;
  pendingConflict: ConflictPayload | null;
  clearConflict: () => void;
};

const FLUSH_THROTTLE_MS = 2_000;

export function useOutboxFlush(): UseOutboxFlushResult {
  const [state, setState] = useState<FlushState>({
    running: false,
    lastFlushedAt: null,
    lastError: null,
  });
  const [pendingConflict, setPendingConflict] = useState<ConflictPayload | null>(null);

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

      // Group by matchId so a conflict on one match doesn't block other
      // matches' rows from flushing.
      const byMatch = new Map<string, MatchEndRow[]>();
      for (const row of queuedEnds) {
        const list = byMatch.get(row.matchId) ?? [];
        list.push(row);
        byMatch.set(row.matchId, list);
      }

      let conflict: ConflictPayload | null = null;

      for (const [matchId, rows] of byMatch.entries()) {
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

          if (result.kind === "remote_newer") {
            // Stop processing this match — the user's resolution choice
            // may overwrite or skip this row. Other matches keep
            // flushing in the outer loop.
            await db.matchEnds.update([row.matchId, row.endNumber] as unknown as string, {
              syncStatus: "queued",
              lastError: "Server has a newer version of this end.",
            });
            conflict = {
              match_id: matchId,
              end_number: row.endNumber,
              local: {
                home_shots: row.homeShots,
                away_shots: row.awayShots,
                localUpdatedAt: row.localUpdatedAt,
              },
              server: result.server,
            };
            break;
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
        if (conflict) break;
      }

      // -- Phase B: submissions -----------------------------------------
      // Skip submissions for any match that hit a conflict — the user
      // needs to resolve ends first.
      if (!conflict) {
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
      }

      setPendingConflict((prev) => conflict ?? prev);
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

  const clearConflict = useCallback(() => setPendingConflict(null), []);

  return { state, flushNow, pendingConflict, clearConflict };
}

// Test-only — re-fetches a row's current local state. The flush worker's
// own state is opaque to consumers, but tests sometimes want to check
// what's in the queue after a flush attempt.
export async function _peekMatchEndForTests(
  matchId: string,
  endNumber: number,
): Promise<MatchEndRow | undefined> {
  // listMatchEndsForMatch is the public reader used by Scorecard;
  // tests can depend on the same path.
  const all = await listMatchEndsForMatch(matchId);
  return all.find((r) => r.endNumber === endNumber);
}
