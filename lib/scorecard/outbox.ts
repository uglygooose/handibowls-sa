"use client";

import Dexie, { type EntityTable } from "dexie";

// Phase 8c — client-side scorecard outbox. Stores per-end scoring rows
// + submission queue rows in IndexedDB via Dexie. Schema versioning
// matters: re-shaping any table after launch needs a numbered upgrade
// callback. Every consumer goes through this module so the schema
// shape is single-source-of-truth.
//
// Tables
//
//   matchEnds      — one row per (match_id, end_number). Rolling end-
//                    by-end shots-won log. UI reads these to compute
//                    rolling totals + render the end-by-end recap. The
//                    server-side derivation lands in Phase 8d alongside
//                    the conflict-resolution worker — until then this
//                    table is the player's single source of truth.
//
//   submissions    — one row per match-final-score submission. Status
//                    transitions: queued → flushing → synced or error.
//                    8d picks these up via a Serwist queue + flushes
//                    via the submitMatch action.
//
// Key design notes
//
//   • Compound primary key for matchEnds: [matchId, endNumber]. Last-
//     write-wins by (match_id, end_number) per the locked offline
//     contract — same key the server-side merge uses (8d).
//   • `localUpdatedAt` carries the client's last-edit time. The 8d
//     conflict modal compares it against the server's `updated_at`
//     when a flush detects a remote-newer row.
//   • Tab-id placeholder (`originTabId`) lets us namespace future
//     cross-tab dedup. Empty in 8c — single-tab scoring is the
//     primary surface — but reserving the column avoids a v2 migration.

export type SyncStatus = "queued" | "flushing" | "synced" | "error";

export type MatchEndRow = {
  matchId: string;
  endNumber: number;
  homeShots: number;
  awayShots: number;
  /** ISO string, client-side. Used by 8d's conflict resolver. */
  localUpdatedAt: string;
  syncStatus: SyncStatus;
  /** Last server error message when syncStatus === "error". */
  lastError: string | null;
  /** Reserved for cross-tab dedup; unused in 8c. */
  originTabId: string;
};

export type SubmissionRow = {
  matchId: string;
  homeShots: number;
  awayShots: number;
  /** ISO string when the user tapped "Submit final". */
  queuedAt: string;
  syncStatus: SyncStatus;
  lastError: string | null;
};

export class HandiBowlsDb extends Dexie {
  matchEnds!: EntityTable<MatchEndRow, "matchId">;
  submissions!: EntityTable<SubmissionRow, "matchId">;

  constructor() {
    super("handibowls");
    // v1 — initial Phase-8c schema. Bump + add upgrade callback when
    // any column shape changes; never delete a v1 column without a
    // migration. The compound key for matchEnds is `[matchId+endNumber]`.
    this.version(1).stores({
      matchEnds: "[matchId+endNumber], matchId, syncStatus",
      submissions: "matchId, syncStatus",
    });
  }
}

// Singleton — one IndexedDB connection per client session. Avoids the
// "double-open" warning on hot reload during dev. The connection
// closes naturally when the browser tab unloads.
let _db: HandiBowlsDb | null = null;
export function getDb(): HandiBowlsDb {
  if (typeof window === "undefined") {
    // SSR safeguard — getDb() must never run on the server. Throwing
    // here surfaces caller bugs early instead of silently writing
    // to a dead handle.
    throw new Error("[outbox] getDb() called server-side");
  }
  if (!_db) _db = new HandiBowlsDb();
  return _db;
}

// ---- helpers ---------------------------------------------------------

export async function upsertMatchEnd(
  row: Omit<MatchEndRow, "syncStatus" | "lastError" | "originTabId" | "localUpdatedAt"> & {
    localUpdatedAt?: string;
  },
): Promise<void> {
  const db = getDb();
  await db.matchEnds.put({
    ...row,
    localUpdatedAt: row.localUpdatedAt ?? new Date().toISOString(),
    syncStatus: "queued",
    lastError: null,
    originTabId: "",
  });
}

export async function listMatchEndsForMatch(
  matchId: string,
): Promise<MatchEndRow[]> {
  const db = getDb();
  const rows = await db.matchEnds.where("matchId").equals(matchId).toArray();
  return rows.sort((a, b) => a.endNumber - b.endNumber);
}

export async function deleteMatchEnd(
  matchId: string,
  endNumber: number,
): Promise<void> {
  const db = getDb();
  // Dexie 4's typed delete on a compound primary key takes the tuple
  // as-is, but the .d.ts narrows the parameter to the first key field
  // (the EntityTable<…, "matchId"> generic). Cast the tuple through
  // unknown so the delete reaches the runtime, which accepts the
  // compound key correctly.
  await db.matchEnds.delete([matchId, endNumber] as unknown as string);
}

export async function queueSubmission(
  matchId: string,
  homeShots: number,
  awayShots: number,
): Promise<void> {
  const db = getDb();
  await db.submissions.put({
    matchId,
    homeShots,
    awayShots,
    queuedAt: new Date().toISOString(),
    syncStatus: "queued",
    lastError: null,
  });
}

export async function markSubmissionSynced(matchId: string): Promise<void> {
  const db = getDb();
  await db.submissions.update(matchId, { syncStatus: "synced" });
}

export async function markSubmissionError(
  matchId: string,
  message: string,
): Promise<void> {
  const db = getDb();
  await db.submissions.update(matchId, {
    syncStatus: "error",
    lastError: message,
  });
}

// Test-only — drops the IndexedDB instance. Used by Vitest cleanup;
// production code never calls this.
export async function _resetForTests(): Promise<void> {
  if (_db) {
    await _db.delete();
    _db = null;
  }
}
